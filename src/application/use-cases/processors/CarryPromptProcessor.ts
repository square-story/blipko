import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IPendingActionRepository } from "../../../domain/repositories/IPendingActionRepository";
import {
  IMessagingPlatform,
  InlineButtonRows,
} from "../../interfaces/IMessagingPlatform";
import { CarryCallback, carryCb, parseCarryCallback } from "../carryCallback";
import {
  CarryFlowDeps,
  settleCarryToOpening,
  settleCarryToSavings,
} from "../carryFlow";
import { formatMoney, periodKey } from "../budgetMath";

const SETTLED = "That cycle's leftover is already sorted 👍";
const STALE = "That's from an older cycle — nothing to carry now.";
// Same TTL as an assistant proposal: long enough to go find the number, short
// enough that a plain "12700" tomorrow is an expense again.
const AMOUNT_TTL_MINUTES = 30;

// The cycle-start carry-forward prompt (callback "car:"). Decides where last
// cycle's leftover goes: into savings (optionally a box) or onto this cycle's
// opening balance.
//
// Parse-based canHandle, like the act: handler: a malformed car: string falls
// through to the parser instead of being claimed and then failing inside.
export class CarryPromptProcessor implements MessageProcessor {
  constructor(
    private readonly deps: CarryFlowDeps,
    private readonly pendingActionRepository: IPendingActionRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    return parseCarryCallback(context.textMessage ?? "") !== null;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId } = context;
    const cb = parseCarryCallback(context.textMessage)!;

    // The button carries the cycle it was drawn for. A tap on last month's
    // message must not settle this month.
    const cycleKey = periodKey(user.payday, new Date(), user.timezone);
    if (cb.cycleKey !== cycleKey) return this.reply(platformUserId, STALE);
    if (user.carryDecidedKey === cycleKey) {
      return this.reply(platformUserId, SETTLED);
    }

    if (cb.choice === "x") return this.askForAmount(context, cycleKey);
    if (cb.choice === "s") return this.askForBox(context, cb, cycleKey);
    return this.settle(context, cb, cycleKey);
  }

  private async askForAmount(
    context: ProcessContext,
    cycleKey: string,
  ): Promise<ProcessOutput> {
    // Staged rather than remembered: it is what lets CarryAmountProcessor know
    // the next bare number is an answer and not an expense.
    await this.pendingActionRepository.create({
      userId: context.user.id,
      kind: "CARRY_AMOUNT",
      payload: { cycleKey },
      summary: "Carry forward — awaiting amount",
      ttlMinutes: AMOUNT_TTL_MINUTES,
    });
    return this.reply(
      context.platformUserId,
      "How much do you want to carry? Send just the amount.",
    );
  }

  private async askForBox(
    context: ProcessContext,
    cb: CarryCallback,
    cycleKey: string,
  ): Promise<ProcessOutput> {
    const amount = cb.amount!;
    const boxes = await this.deps.boxRepository.listWithBalances(
      context.user.id,
    );
    if (boxes.length === 0) {
      return this.settle(context, { cycleKey, choice: "s0", amount }, cycleKey);
    }
    const rows: InlineButtonRows = boxes.slice(0, 6).map((box) => [
      {
        id: carryCb.box(cycleKey, amount, box.id),
        title: `${box.icon ? `${box.icon} ` : ""}${box.name}`,
      },
    ]);
    rows.push([
      {
        id: carryCb.savingsNoBox(cycleKey, amount),
        title: "💰 Just savings, no box",
      },
    ]);
    const body = `Which box should ${formatMoney(amount)} go into?`;
    await this.messageService.sendInteractiveMessage(
      context.platformUserId,
      body,
      rows,
    );
    return { response: body, parsed: { intent: "UNKNOWN", confidence: 1 } };
  }

  private async settle(
    context: ProcessContext,
    cb: CarryCallback,
    cycleKey: string,
  ): Promise<ProcessOutput> {
    const { user, platformUserId } = context;

    // Claim first: the write happens only for the caller that won the cycle.
    const claimed = await this.deps.userRepository.claimCarryCycle(
      user.id,
      cycleKey,
    );
    if (!claimed) return this.reply(platformUserId, SETTLED);

    if (cb.choice === "n") {
      return this.reply(
        platformUserId,
        "👍 Left as is — I'll ask again next cycle.",
      );
    }

    const amount = cb.amount!;
    if (cb.choice === "o") {
      return this.reply(
        platformUserId,
        await settleCarryToOpening(this.deps, user, amount),
      );
    }

    const box = cb.boxId
      ? await this.deps.boxRepository.findByIdForUser(cb.boxId, user.id)
      : null;
    // A deleted box still leaves money to file. Save it anyway and say why the
    // box is missing, rather than dropping the cycle's only claim on the floor.
    const prefix =
      cb.boxId && !box ? "That box is gone — saved instead.\n" : "";
    return this.reply(
      platformUserId,
      prefix + (await settleCarryToSavings(this.deps, user, amount, box)),
    );
  }

  private async reply(
    platformUserId: string,
    body: string,
  ): Promise<ProcessOutput> {
    await this.messageService.sendMessage({ to: platformUserId, body });
    return { response: body, parsed: { intent: "UNKNOWN", confidence: 1 } };
  }
}
