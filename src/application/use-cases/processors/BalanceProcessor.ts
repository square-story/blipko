import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IPendingActionRepository } from "../../../domain/repositories/IPendingActionRepository";
import { IMessagingPlatform } from "../../interfaces/IMessagingPlatform";
import { parsePendingPayload } from "../../../domain/entities/PendingAction";
import { balanceCb, parseBalanceCallback } from "../balanceCallback";
import {
  ExpectedBalance,
  balanceVerdict,
  expectedBalance,
  parseBalanceText,
} from "../balanceCheck";
import {
  CarryFlowDeps,
  UNTRACKED_CATEGORY,
  ensureNamedCategory,
} from "../carryFlow";
import { formatMoney } from "../budgetMath";

// Long enough to go check the bank app and come back; short enough that a
// stale gap can't be logged against a balance that has since moved on.
const GAP_TTL_MINUTES = 24 * 60;
const PARSED = { intent: "UNKNOWN" as const, confidence: 1 };

// "balance 12400" / "/balance": compares the user's real total balance with the
// last one plus everything logged since, names the gap, and offers to log it
// (callback "bal:"). The anchor moves to the new figure only once the books
// close — a match, or a tap on the gap buttons. Moving it while a gap is open
// would make whatever the user logs to explain that gap count twice.
export class BalanceProcessor implements MessageProcessor {
  constructor(
    private readonly deps: CarryFlowDeps,
    private readonly pendingActionRepository: IPendingActionRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    const text = context.textMessage ?? "";
    if (parseBalanceCallback(text)) return true;
    if (context.replyTarget) return false;
    return parseBalanceText(text) !== null;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const cb = parseBalanceCallback(context.textMessage);
    if (cb) return this.settleGap(context, cb.id, cb.choice);

    const { amount, invalid } = parseBalanceText(context.textMessage)!;
    const { user, platformUserId } = context;
    if (invalid) {
      return this.reply(
        platformUserId,
        `Send your total balance as a plain number, like "balance 12400".`,
      );
    }
    const now = new Date();
    const exp = await expectedBalance(this.deps, user, now);

    if (amount === null) {
      return this.reply(
        platformUserId,
        exp
          ? `Expected now: ${formatMoney(exp.expected)} — ${formatMoney(exp.anchor)} on ${this.day(exp.anchorAt, user.timezone)}, +${formatMoney(exp.income)} income, −${formatMoney(exp.spent)} spent since. Send your real balance like "balance 9000" to check.`
          : `Send your total balance (bank + UPI + cash) like "balance 12400" — I'll check it against what you log from today.`,
      );
    }

    if (!exp) {
      await this.anchor(user.id, amount, now);
      return this.reply(
        platformUserId,
        `✅ Balance saved: ${formatMoney(amount)}. Next time you send it, I'll check it against everything logged since.`,
      );
    }
    return this.check(context, exp, amount, now);
  }

  private async check(
    context: ProcessContext,
    exp: ExpectedBalance,
    actual: number,
    now: Date,
  ): Promise<ProcessOutput> {
    const { user, platformUserId } = context;
    const { gap, verdict } = balanceVerdict(exp.expected, actual);
    const head =
      `🔍 Balance check since ${this.day(exp.anchorAt, user.timezone)}\n` +
      `Started ${formatMoney(exp.anchor)} · income +${formatMoney(exp.income)} · spent −${formatMoney(exp.spent)}\n` +
      `Expected ${formatMoney(exp.expected)} · you have ${formatMoney(actual)}`;

    if (verdict === "MATCH") {
      await this.anchor(user.id, actual, now);
      return this.reply(platformUserId, `${head}\n\n✅ All accounted for.`);
    }
    if (verdict === "EXTRA") {
      return this.reply(
        platformUserId,
        `${head}\n\nYou have ${formatMoney(-gap)} more than expected — probably income or a refund that wasn't logged. Log it (like "refund 1500"), then send your balance again.`,
      );
    }

    const amount = Math.round(gap);
    const body =
      `${head}\n\n${formatMoney(amount)} isn't accounted for — usually small cash or UPI spends that never got logged.\n` +
      `Paid a credit-card bill? Tap Skip — those spends are already logged.`;
    // The body rides on the staged row so the tap can keep it while it clears
    // the buttons.
    const staged = await this.pendingActionRepository.create({
      userId: user.id,
      kind: "BALANCE_GAP",
      payload: {
        amount,
        actual,
        at: now.toISOString(),
        since: exp.anchorAt.toISOString(),
      },
      summary: body,
      ttlMinutes: GAP_TTL_MINUTES,
    });
    await this.messageService.sendInteractiveMessage(platformUserId, body, [
      [
        {
          id: balanceCb.log(staged.id),
          title: `Log ${formatMoney(amount)} as Untracked`,
        },
        { id: balanceCb.skip(staged.id), title: "Skip" },
      ],
    ]);
    return { response: body, parsed: PARSED };
  }

  private async settleGap(
    context: ProcessContext,
    id: string,
    choice: "y" | "n",
  ): Promise<ProcessOutput> {
    const { user, platformUserId } = context;
    const row = await this.pendingActionRepository.findLiveForUser(id, user.id);
    const parsed = row && parsePendingPayload(row.kind, row.payload);
    if (!row || parsed?.kind !== "BALANCE_GAP") {
      return this.toast("That check has expired — send your balance again.");
    }
    const gap = parsed.data as {
      amount: number;
      actual: number;
      at: string;
      since: string;
    };
    if (user.balanceAnchorAt?.toISOString() !== gap.since) {
      return this.toast("That check is out of date — send your balance again.");
    }
    if (!(await this.pendingActionRepository.consume(id, user.id))) {
      return this.toast("Already done");
    }

    let note = "Skipped";
    if (choice === "y") {
      const categoryId = await ensureNamedCategory(
        this.deps.categoryRepository,
        user.id,
        UNTRACKED_CATEGORY,
        "WANTS",
      );
      await this.deps.expenseRepository.create({
        userId: user.id,
        amount: gap.amount,
        bucket: "WANTS",
        categoryId,
        note: UNTRACKED_CATEGORY,
        rawText: `[balance] untracked since ${this.day(new Date(gap.since), user.timezone)}`,
        confidence: 1,
        // Just before the new anchor, so the next check doesn't count it again.
        date: new Date(Date.parse(gap.at) - 1000),
      });
      note = `Logged ${formatMoney(gap.amount)} as Untracked`;
    }
    // Either way the books are closed as of the check.
    await this.anchor(user.id, gap.actual, new Date(gap.at));

    if (
      context.callbackMessageId &&
      this.messageService.editInteractiveMessage
    ) {
      await this.messageService.editInteractiveMessage(
        platformUserId,
        context.callbackMessageId,
        `${row.summary}\n\n${choice === "y" ? `✅ ${note}.` : "Skipped."}`,
        [],
      );
    }
    return {
      response: note,
      parsed: PARSED,
      toast: note,
      historyText: `[balance gap: ${note.toLowerCase()}]`,
    };
  }

  private anchor(userId: string, amount: number, at: Date) {
    return this.deps.userRepository.update(userId, {
      balanceAnchor: amount,
      balanceAnchorAt: at,
    });
  }

  private day(date: Date, tz: string): string {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: tz,
    }).format(date);
  }

  private toast(text: string): ProcessOutput {
    return { response: text, parsed: PARSED, toast: text };
  }

  private async reply(
    platformUserId: string,
    body: string,
  ): Promise<ProcessOutput> {
    await this.messageService.sendMessage({ to: platformUserId, body });
    return { response: body, parsed: PARSED };
  }
}
