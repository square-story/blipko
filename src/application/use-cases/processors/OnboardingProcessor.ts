import { NotificationDosage } from "@prisma/client";
import {
  MessageProcessor,
  ProcessContext,
  ProcessOutput,
} from "./MessageProcessor";
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import { IBudgetConfigRepository } from "../../../domain/repositories/IBudgetConfigRepository";
import {
  CloneGroupInput,
  ICategoryRepository,
} from "../../../domain/repositories/ICategoryRepository";
import {
  IMessagingPlatform,
  InlineButtonRows,
} from "../../interfaces/IMessagingPlatform";
import {
  bucketBudget,
  formatMoney,
  suggestCategoryBudgets,
  SelectedLeaf,
} from "../budgetMath";
import {
  CATEGORY_TEMPLATE,
  groupByKey,
  GroupTemplate,
} from "../../../domain/categoryTemplate";

const DEFAULT_SPLIT = { needsPct: 50, wantsPct: 30, savingsPct: 20 };
const MAX_INCOME = 100_000_000;
const PURE_NUMBER_RE = /^\s*₹?\s*([\d,]+(?:\.\d+)?)\s*$/;

type Draft = { income?: number; groups?: string[] };

const DOSAGE_LABEL: Record<NotificationDosage, string> = {
  OFF: "No reminders",
  GENTLE: "Gentle (1–2 a day)",
  AGGRESSIVE: "Aggressive",
  RELENTLESS: "Relentless",
};

// Multi-step onboarding wizard: greet → capture income → multi-select category
// groups (auto-creating their children with suggested budgets) → pick a reminder
// dosage. State lives in user.onboardingStep + user.onboardingDraft so it
// survives across messages. Runs before AI parsing; also owns the "ob:" button
// callbacks.
export class OnboardingProcessor implements MessageProcessor {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly budgetConfigRepository: IBudgetConfigRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly messageService: IMessagingPlatform,
  ) {}

  canHandle(context: ProcessContext): boolean {
    if (context.textMessage.startsWith("ob:")) return true;
    const normalized = context.textMessage.trim().toLowerCase();
    if (normalized === "start" || normalized === "/start") return true;
    return !context.user.hasOnboarded;
  }

  async process(context: ProcessContext): Promise<ProcessOutput> {
    const { user, platformUserId, textMessage } = context;
    const draft = ((user.onboardingDraft as Draft | null) ?? {}) as Draft;

    if (textMessage.startsWith("ob:")) {
      return this.handleCallback(context, draft);
    }

    // Already onboarded and typed /start → friendly welcome-back.
    if (user.hasOnboarded) {
      return this.reply(
        platformUserId,
        `👋 Welcome back! Just text me what you spend — like "chai 30" or "auto 80". Type /help anytime.`,
      );
    }

    const step = user.onboardingStep ?? "ASK_INCOME";

    if (step === "ASK_INCOME") {
      const match = textMessage.match(PURE_NUMBER_RE);
      const income = match?.[1] ? Number(match[1].replace(/,/g, "")) : NaN;
      if (income > 0 && income <= MAX_INCOME) {
        return this.captureIncome(user.id, platformUserId, income);
      }
      await this.userRepository.update(user.id, {
        onboardingStep: "ASK_INCOME",
      });
      return this.reply(
        platformUserId,
        `👋 Welcome! I help you track spending and stay on budget — just by chatting.\n\nFirst, what's your *monthly take-home income* (post-tax)? Send the number, e.g. 50000.`,
      );
    }

    // Mid-wizard but the user typed instead of tapping → re-show the keyboard.
    if (step === "PICK_GROUPS") {
      await this.messageService.sendInteractiveMessage(
        platformUserId,
        groupPrompt(),
        groupKeyboard(draft.groups ?? []),
      );
      return this.ack("PICK_GROUPS");
    }
    if (step === "PICK_DOSAGE") {
      await this.messageService.sendInteractiveMessage(
        platformUserId,
        dosagePrompt(),
        dosageKeyboard(),
      );
      return this.ack("PICK_DOSAGE");
    }

    return this.reply(platformUserId, `Send /start to set up your budget.`);
  }

  private async captureIncome(
    userId: string,
    platformUserId: string,
    income: number,
  ): Promise<ProcessOutput> {
    const existingConfig =
      await this.budgetConfigRepository.findByUserId(userId);
    if (!existingConfig) await this.budgetConfigRepository.create({ userId });

    const defaults = CATEGORY_TEMPLATE.filter((g) => g.defaultSelected).map(
      (g) => g.key,
    );
    await this.userRepository.update(userId, {
      monthlyIncome: income,
      onboardingStep: "PICK_GROUPS",
      onboardingDraft: { income, groups: defaults },
    });

    const needs = bucketBudget(income, DEFAULT_SPLIT, "NEEDS");
    const wants = bucketBudget(income, DEFAULT_SPLIT, "WANTS");
    const savings = bucketBudget(income, DEFAULT_SPLIT, "SAVINGS");
    const body = `Nice — on ${formatMoney(income)}/mo your 50/30/20 plan is:
🏠 Needs ${formatMoney(needs)} · 🎯 Wants ${formatMoney(wants)} · 💰 Savings ${formatMoney(savings)}

${groupPrompt()}`;

    await this.messageService.sendInteractiveMessage(
      platformUserId,
      body,
      groupKeyboard(defaults),
    );
    return this.ack("PICK_GROUPS");
  }

  private async handleCallback(
    context: ProcessContext,
    draft: Draft,
  ): Promise<ProcessOutput> {
    const { user, platformUserId, textMessage, callbackMessageId } = context;
    const [, action, value] = textMessage.split(":");

    if (action === "grp" && value) {
      const selected = new Set(draft.groups ?? []);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      const groups = [...selected];
      await this.userRepository.update(user.id, {
        onboardingDraft: { ...draft, groups },
      });
      await this.edit(
        platformUserId,
        callbackMessageId,
        groupPrompt(),
        groupKeyboard(groups),
      );
      return this.ack("PICK_GROUPS");
    }

    if (action === "done") {
      return this.finalizeGroups(context, draft);
    }

    if (action === "dose" && value) {
      return this.finishOnboarding(context, value as NotificationDosage);
    }

    return this.reply(
      platformUserId,
      "Tap one of the buttons above to continue.",
    );
  }

  private async finalizeGroups(
    context: ProcessContext,
    draft: Draft,
  ): Promise<ProcessOutput> {
    const { user, platformUserId, callbackMessageId } = context;
    const income = draft.income ?? Number(user.monthlyIncome ?? 0);
    const keys = draft.groups ?? [];
    const groups = keys
      .map(groupByKey)
      .filter((g): g is GroupTemplate => Boolean(g));

    if (groups.length === 0) {
      await this.edit(
        platformUserId,
        callbackMessageId,
        "Pick at least one group so I know what to track.",
        groupKeyboard([]),
      );
      return this.ack("PICK_GROUPS");
    }

    const leaves: SelectedLeaf[] = groups.flatMap((g) =>
      g.children.map((c) => ({
        name: c.name,
        bucket: c.bucket,
        weight: c.weight,
      })),
    );
    const budgets = suggestCategoryBudgets(income, DEFAULT_SPLIT, leaves);

    const cloneInput: CloneGroupInput[] = groups.map((g) => ({
      name: g.name,
      bucket: g.bucket,
      children: g.children.map((c) => ({
        name: c.name,
        bucket: c.bucket,
        monthlyBudget: budgets.get(c.name),
      })),
    }));
    const leafCount = await this.categoryRepository.cloneGroupsForUser(
      user.id,
      cloneInput,
    );

    await this.userRepository.update(user.id, {
      onboardingStep: "PICK_DOSAGE",
    });

    const body = `✅ Set up ${leafCount} categories with suggested limits — tweak any of them later on the web.\n\n${dosagePrompt()}`;
    await this.edit(platformUserId, callbackMessageId, body, dosageKeyboard());
    return this.ack("PICK_DOSAGE");
  }

  private async finishOnboarding(
    context: ProcessContext,
    dosage: NotificationDosage,
  ): Promise<ProcessOutput> {
    const { user, platformUserId, callbackMessageId } = context;
    const safeDosage: NotificationDosage = (
      ["OFF", "GENTLE", "AGGRESSIVE", "RELENTLESS"] as NotificationDosage[]
    ).includes(dosage)
      ? dosage
      : "OFF";

    await this.userRepository.update(user.id, {
      hasOnboarded: true,
      onboardingStep: null,
      onboardingDraft: null,
      notificationDosage: safeDosage,
    });

    const body = `🎉 You're all set — reminders: *${DOSAGE_LABEL[safeDosage]}*.

Just text me what you spend, like "chai 30" or "auto 80". Send a voice note too.
• /status — how your budget's doing
• /settings — change reminders
Everything's editable on the web dashboard anytime.`;
    await this.edit(platformUserId, callbackMessageId, body, []);
    return { response: body, parsed: { intent: "UNKNOWN", confidence: 1 } };
  }

  private async edit(
    to: string,
    messageId: string | undefined,
    body: string,
    rows: InlineButtonRows,
  ): Promise<void> {
    if (messageId && this.messageService.editInteractiveMessage) {
      await this.messageService.editInteractiveMessage(
        to,
        messageId,
        body,
        rows,
      );
      return;
    }
    if (rows.length > 0) {
      await this.messageService.sendInteractiveMessage(to, body, rows);
    } else {
      await this.messageService.sendMessage({ to, body });
    }
  }

  private async reply(
    platformUserId: string,
    body: string,
  ): Promise<ProcessOutput> {
    await this.messageService.sendMessage({ to: platformUserId, body });
    return {
      response: body,
      parsed: { intent: "UNKNOWN", confidence: 1 },
    };
  }

  // The reply text isn't user-facing here (the message was already sent/edited);
  // it's bookkeeping for the use-case's conversation log.
  private ack(step: string): ProcessOutput {
    return {
      response: `[onboarding:${step}]`,
      parsed: { intent: "UNKNOWN", confidence: 1 },
    };
  }
}

function groupPrompt(): string {
  return `Now tap the things you spend on (common ones are already ticked), then press *Done*:`;
}

function groupKeyboard(selectedKeys: string[]): InlineButtonRows {
  const selected = new Set(selectedKeys);
  const rows: InlineButtonRows = [];
  for (let i = 0; i < CATEGORY_TEMPLATE.length; i += 2) {
    rows.push(
      CATEGORY_TEMPLATE.slice(i, i + 2).map((g) => ({
        id: `ob:grp:${g.key}`,
        title: `${selected.has(g.key) ? "✅" : "▫️"} ${g.name}`,
      })),
    );
  }
  rows.push([{ id: "ob:done", title: "Done ✅" }]);
  return rows;
}

function dosagePrompt(): string {
  return `Last thing — how should I keep you on track? (Change anytime with /settings.)`;
}

function dosageKeyboard(): InlineButtonRows {
  return [
    [
      { id: "ob:dose:OFF", title: "😴 No reminders" },
      { id: "ob:dose:GENTLE", title: "🔔 Gentle" },
    ],
    [
      { id: "ob:dose:AGGRESSIVE", title: "⚡ Aggressive" },
      { id: "ob:dose:RELENTLESS", title: "🔥 Relentless" },
    ],
  ];
}
