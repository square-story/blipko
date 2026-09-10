import { Bucket } from "@prisma/client";
import { INCOME_CATEGORY_TEMPLATE } from "../../domain/incomeCategoryTemplate";
import {
  DateRange,
  IFinancialDataTools,
} from "../../domain/services/IFinancialDataTools";
import { IAssistantWriteTools } from "../../domain/services/IAssistantWriteTools";
import { buildProductFacts } from "../../domain/productFacts";
import { logger } from "../../utils/logger";
import { describeError } from "../../utils/describeError";

// The single source of truth for what the assistant can do. Provider-neutral:
// each agent renders these into its own schema dialect, so a description or a
// dispatch rule can never drift between the OpenAI and Anthropic paths.
//
// The descriptions carry the anti-hallucination rules. That placement is
// deliberate — a rule attached to the tool the model is about to pick lands
// better than the same sentence buried in a system prompt.

const BUCKETS = ["NEEDS", "WANTS", "SAVINGS"] as const;

export interface ToolDef {
  name: string;
  description: string;
  properties: Record<string, unknown>;
  required: string[];
}

const RANGE_PROPS = {
  from: {
    type: "string",
    description:
      "Start date YYYY-MM-DD in the user's local time (inclusive). Omit for the current cycle.",
  },
  to: {
    type: "string",
    description:
      "End date YYYY-MM-DD in the user's local time, INCLUSIVE — the whole of this day is counted. Omit for the current cycle.",
  },
} as const;

const BUCKET_PROP = {
  bucket: {
    type: "string",
    enum: BUCKETS,
    description: "Optional 50/30/20 bucket filter.",
  },
} as const;

// `categoryNames` become an enum, which is the strongest grounding lever here:
// the model cannot filter on a category the user does not have, so it cannot
// invent one to explain a number.
//
// `includeWrites` gates the propose_* tools. The read-only query agent omits
// them entirely rather than exposing tools it has no way to fulfil.
export function buildToolCatalog(
  categoryNames: string[],
  includeWrites = false,
): ToolDef[] {
  const categoryProp =
    categoryNames.length > 0
      ? {
          category: {
            type: "string",
            enum: categoryNames,
            description:
              "Optional category filter. Must be one of the user's own categories.",
          },
        }
      : {};

  return [
    {
      name: "get_period_status",
      description:
        'Current-cycle budget health per bucket: budget, spent, remaining, percent, safe daily spend, plus a precomputed `status` and a plain-English `interpretation`. Use for overall status. Do not compare the numbers yourself — `status` already says whether a bucket is over, near its limit, or on track. `status` is a machine value for your reasoning, NOT words to show the user: never write it out ("you\'re ON_TRACK" is wrong). Say it in your own words, or use `interpretation`, which already knows that being over on SAVINGS is a good thing and being over on WANTS is not.',
      properties: {},
      required: [],
    },
    {
      name: "check_affordability",
      description:
        "Whether a specific purchase fits the remaining budget. Returns a decided `verdict` (YES / TIGHT / NO) with the figures behind it. ALWAYS use this for 'can I afford X?' — never subtract the amount from a balance yourself.",
      properties: {
        amount: {
          type: "number",
          description: "The purchase amount to test, in rupees.",
        },
        ...BUCKET_PROP,
      },
      required: ["amount"],
    },
    {
      name: "compare_cycles",
      description:
        "The current budget cycle against recent COMPLETE cycles, with the change already computed (`vsPrevious.direction`, `deltaPct`, `delta`). Use for 'am I spending more than last month?'. The result carries a note about the current cycle being partial — repeat that caveat in your answer.",
      properties: {
        cycles: {
          type: "number",
          description:
            "How many previous complete cycles to include (1-6, default 1).",
        },
      },
      required: [],
    },
    {
      name: "get_spend_by_bucket",
      description:
        "Total spend per bucket over a date range (defaults to the current cycle). Pass a bucket to scope to one.",
      properties: { ...RANGE_PROPS, ...BUCKET_PROP },
      required: [],
    },
    {
      name: "get_spend_by_category",
      description:
        "Top spending categories over a date range (defaults to the current cycle), highest first. Use this for category totals rather than adding up individual expenses.",
      properties: {
        ...RANGE_PROPS,
        ...BUCKET_PROP,
        limit: { type: "number", description: "Max categories (default 5)." },
      },
      required: [],
    },
    {
      name: "get_income",
      description:
        "Total income logged over a date range (defaults to the current cycle). An empty result means no income was LOGGED, not that the user earned nothing.",
      properties: { ...RANGE_PROPS },
      required: [],
    },
    {
      name: "get_recent_expenses",
      description:
        "Individual recent expenses, newest first. Use for 'my last few spends' or 'when did I last spend on X'. For a total, use get_spend_by_category — do not add these rows up yourself.",
      properties: {
        ...RANGE_PROPS,
        ...categoryProp,
        limit: { type: "number", description: "Max rows (default 10)." },
      },
      required: [],
    },
    {
      name: "get_categories",
      description:
        "The user's categories with their bucket and monthly budget cap, if set.",
      properties: {},
      required: [],
    },
    {
      name: "get_boxes",
      description:
        "The user's savings boxes (named goals/funds) with balance and progress toward target.",
      properties: {},
      required: [],
    },
    {
      name: "get_recurring_rules",
      description:
        "The user's active recurring income/expense rules (amount, day of month, bucket, category).",
      properties: {},
      required: [],
    },
    {
      name: "get_product_info",
      description:
        "Facts about Blipko itself: what it is, what it can do, the commands, the dashboard, how your data is handled, and who built it. Use this for ANY question about the product — 'what can you do?', 'how does this work?', 'who made you?', 'how does this help me?'. Never answer those from your own knowledge: this returns the truth for THIS build, and anything you invent will send the user looking for a feature that does not exist. It contains NO figures about this user — so if explaining how something works would read better with numbers (\"how does 50/30/20 work?\"), call get_period_status as well and use their real ones. Never illustrate with an example income or budget: the user will read it as theirs.",
      properties: {
        topic: {
          type: "string",
          enum: [
            "overview",
            "features",
            "commands",
            "dashboard",
            "privacy",
            "creator",
          ],
          description:
            "Omit for the overview. 'features' includes what each one is for, which is what to use when asked how Blipko helps them.",
        },
      },
      required: [],
    },
    {
      name: "open_dashboard",
      description:
        "Show the user a tappable button to their dashboard. Use when they ask for it, and when what they want genuinely lives there — charts and trends, editing categories or their limits, changing income, CSV export, or connecting an account. Do not use it to dodge a question you can answer from their data.",
      properties: {
        reason: {
          type: "string",
          description:
            "What they should do there, e.g. 'edit category limits'.",
        },
      },
      required: ["reason"],
    },
    ...(includeWrites ? writeTools(categoryProp) : []),
  ];
}

function writeTools(categoryProp: Record<string, unknown>): ToolDef[] {
  return [
    // ── Writes ───────────────────────────────────────────────────────────────
    // None of these change anything. Each records a proposal and returns a
    // summary; the user taps a button and a deterministic handler performs the
    // write. Before calling one, paraphrase back what you are about to do.
    {
      name: "propose_recurring",
      description:
        "Propose a repeating monthly income or expense (rent, salary, a subscription). Does NOT create it — the user confirms with a button. Confirm the amount, the day of the month and what it is for before calling.",
      properties: {
        kind: {
          type: "string",
          enum: ["INCOME", "EXPENSE"],
          description:
            "INCOME for money coming in, EXPENSE for money going out.",
        },
        amount: { type: "number", description: "Amount in rupees." },
        dayOfMonth: {
          type: "number",
          description: "Day of the month it repeats, 1-28.",
        },
        ...BUCKET_PROP,
        category: {
          type: "string",
          description:
            "For an EXPENSE rule, one of the user's spending categories. For an INCOME rule, one of the income categories: " +
            INCOME_CATEGORY_TEMPLATE.map((c) => c.name).join(", ") +
            ". The two are separate taxonomies — never use a spending category on an income rule.",
        },
        note: { type: "string", description: "Short label, e.g. 'rent'." },
      },
      required: ["kind", "amount", "dayOfMonth"],
    },
    {
      name: "propose_box_move",
      description:
        "Propose moving money into or out of one of the user's savings boxes. Does NOT move it — the user confirms with a button. Use get_boxes first if you are unsure which box they mean; never guess between two similar names.",
      properties: {
        box: {
          type: "string",
          description: "The box name, exactly as listed by get_boxes.",
        },
        amount: { type: "number", description: "Amount in rupees." },
        direction: {
          type: "string",
          enum: ["IN", "OUT"],
          description: "IN adds money to the box, OUT withdraws from it.",
        },
        note: { type: "string", description: "Optional short note." },
      },
      required: ["box", "amount", "direction"],
    },
    {
      name: "propose_delete_expense",
      description:
        "Propose deleting one of the user's expenses. Does NOT delete it — the user confirms with a button. Find the expense with get_recent_expenses first and quote it back so they know which one you mean.",
      properties: {
        expenseId: {
          type: "string",
          description: "The id from get_recent_expenses.",
        },
      },
      required: ["expenseId"],
    },
    {
      name: "propose_expense_edit",
      description:
        "Propose changing an existing expense's amount, bucket, category or note. Does NOT change it — the user confirms with a button. Send only the fields that change.",
      properties: {
        expenseId: {
          type: "string",
          description: "The id from get_recent_expenses.",
        },
        amount: { type: "number", description: "New amount in rupees." },
        ...BUCKET_PROP,
        ...categoryProp,
        note: { type: "string", description: "New note." },
      },
      required: ["expenseId"],
    },
  ];
}

// Runs a tool and ALWAYS resolves. A throw would kill the whole turn with no
// model-visible recovery; a soft error lets it correct itself in-loop.
// Everything a tool call needs that does not come from the model.
export interface ToolRunContext {
  tools: IFinancialDataTools;
  userId: string;
  categoryNames: string[];
  // Null for the read-only lane, which has no propose_* tools.
  writes?: IAssistantWriteTools | null | undefined;
  // From env.WEB_APP_URL, never hardcoded — a link the bot hands out must not
  // be able to disagree with where the app is actually deployed.
  dashboardUrl: string;
}

export async function runAssistantTool(
  ctx: ToolRunContext,
  name: string,
  rawArgs: unknown,
): Promise<unknown> {
  const { tools, userId, categoryNames, dashboardUrl } = ctx;
  const writes = ctx.writes ?? null;
  const args = normalizeArgs(rawArgs);
  if (!args) {
    return {
      ok: false,
      error: "invalid_arguments",
      message: "Tool arguments were not valid JSON. Retry the call.",
    };
  }

  // Reject an unknown category here rather than letting it filter to zero rows
  // — a silent [] reads to the model as "you spent nothing on that".
  const category = asString(args.category);
  if (category && !categoryNames.includes(category)) {
    return {
      ok: false,
      error: "unknown_category",
      message: `"${category}" is not one of the user's categories.`,
      available_categories: categoryNames,
    };
  }

  const range: DateRange = { from: asString(args.from), to: asString(args.to) };
  const bucket = asBucket(args.bucket);

  try {
    const product = dispatchProduct(name, args, dashboardUrl);
    if (product !== undefined) return product;

    const proposal = await dispatchWrite(writes, name, args, userId);
    if (proposal !== undefined) return proposal;

    const result = await dispatch(tools, name, args, range, bucket, userId);
    if (result === undefined) {
      return {
        ok: false,
        error: "unknown_tool",
        message: `No tool named ${name}.`,
      };
    }
    // A dispatch-level validation failure already carries its own ok:false.
    return "ok" in (result as object) ? result : { ok: true, ...result };
  } catch (error) {
    // The message must NOT carry internal detail: it is returned to the model,
    // sent to the provider, and persisted in ConversationMessage.toolCalls.
    // `requireUser` throws with the internal user id; a Prisma connection error
    // embeds the database host and username. Log those, don't publish them.
    logger.error("Assistant tool failed", {
      component: "assistant",
      tool: name,
      userId,
      err: describeError(error),
    });
    return {
      ok: false,
      error: "tool_failed",
      message:
        "That lookup failed. Try a different tool, or tell the user you cannot answer right now.",
    };
  }
}

// Questions about Blipko itself. Answered from a curated file for the same
// reason financial figures are: the model's own impression of what a budgeting
// app does would be plausible, confident and occasionally invented.
function dispatchProduct(
  name: string,
  args: Record<string, unknown>,
  dashboardUrl: string,
): unknown | undefined {
  const facts = buildProductFacts(dashboardUrl);

  if (name === "open_dashboard") {
    return {
      ok: true,
      url: facts.dashboard.url,
      // The caller renders this as a button; the model should not paste the
      // raw URL into its reply as well.
      instruction:
        "A tappable dashboard button is being shown to the user. Tell them what to do there — do not repeat the URL.",
    };
  }

  if (name !== "get_product_info") return undefined;

  const topic = asString(args.topic);
  switch (topic) {
    case "features":
      return { ok: true, features: facts.features };
    case "commands":
      return { ok: true, commands: facts.commands };
    case "dashboard":
      return { ok: true, dashboard: facts.dashboard };
    case "privacy":
      return { ok: true, dataHandling: facts.dataHandling };
    case "creator":
      return { ok: true, creator: facts.creator };
    default:
      return {
        ok: true,
        whatItIs: facts.whatItIs,
        howLoggingWorks: facts.howLoggingWorks,
        features: facts.features.map((f) => f.name),
        commands: facts.commands,
        dashboardUrl: facts.dashboard.url,
        note: "This is the overview. Call get_product_info again with a topic for the detail behind any of it.",
      };
  }
}

// Returns undefined when `name` is not a write tool, so the caller falls
// through to the read dispatch.
async function dispatchWrite(
  writes: IAssistantWriteTools | null,
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown | undefined> {
  if (!name.startsWith("propose_")) return undefined;
  if (!writes) {
    return {
      ok: false,
      error: "writes_unavailable",
      message: "This assistant cannot make changes. Answer with data instead.",
    };
  }

  const amount = asNumber(args.amount);

  switch (name) {
    case "propose_recurring": {
      const kind = args.kind === "INCOME" ? "INCOME" : "EXPENSE";
      const dayOfMonth = asNumber(args.dayOfMonth);
      if (amount === undefined || amount <= 0) {
        return invalid("propose_recurring needs a positive `amount`.");
      }
      if (dayOfMonth === undefined || dayOfMonth < 1 || dayOfMonth > 28) {
        return invalid("`dayOfMonth` must be between 1 and 28.");
      }
      return writes.proposeRecurring(userId, {
        kind,
        amount,
        dayOfMonth,
        bucket: asString(args.bucket),
        category: asString(args.category),
        note: asString(args.note),
      });
    }
    case "propose_box_move": {
      const box = asString(args.box);
      const direction = args.direction === "OUT" ? "OUT" : "IN";
      if (!box) return invalid("propose_box_move needs a `box` name.");
      if (amount === undefined || amount <= 0) {
        return invalid("propose_box_move needs a positive `amount`.");
      }
      return writes.proposeBoxMove(userId, {
        box,
        amount,
        direction,
        note: asString(args.note),
      });
    }
    case "propose_delete_expense": {
      const expenseId = asString(args.expenseId);
      if (!expenseId)
        return invalid("propose_delete_expense needs `expenseId`.");
      return writes.proposeDeleteExpense(userId, { expenseId });
    }
    case "propose_expense_edit": {
      const expenseId = asString(args.expenseId);
      if (!expenseId) return invalid("propose_expense_edit needs `expenseId`.");
      return writes.proposeExpenseEdit(userId, {
        expenseId,
        amount,
        bucket: asString(args.bucket),
        category: asString(args.category),
        note: asString(args.note),
      });
    }
    default:
      return {
        ok: false,
        error: "unknown_tool",
        message: `No tool named ${name}.`,
      };
  }
}

function invalid(message: string) {
  return { ok: false, error: "invalid_arguments", message };
}

async function dispatch(
  tools: IFinancialDataTools,
  name: string,
  args: Record<string, unknown>,
  range: DateRange,
  bucket: Bucket | undefined,
  userId: string,
): Promise<object | undefined> {
  switch (name) {
    case "get_period_status":
      return tools.getPeriodStatus(userId);
    case "get_spend_by_bucket":
      return tools.getSpendByBucket(userId, range, bucket);
    case "get_spend_by_category":
      return tools.getSpendByCategory(
        userId,
        range,
        bucket,
        asNumber(args.limit),
      );
    case "get_income":
      return tools.getIncome(userId, range);
    case "get_recent_expenses":
      return tools.getRecentExpenses(userId, {
        limit: asNumber(args.limit),
        category: asString(args.category),
        range: args.from || args.to ? range : undefined,
      });
    case "get_recurring_rules":
      return tools.getRecurringRules(userId);
    case "get_categories":
      return tools.getCategories(userId);
    case "get_boxes":
      return tools.getBoxes(userId);
    case "compare_cycles":
      return tools.compareCycles(userId, asNumber(args.cycles));
    case "check_affordability": {
      const amount = asNumber(args.amount);
      if (amount === undefined || amount <= 0) {
        return {
          ok: false,
          error: "invalid_amount",
          message: "check_affordability needs a positive `amount`.",
        };
      }
      return tools.checkAffordability(userId, amount, bucket);
    }
    default:
      return undefined;
  }
}

// OpenAI hands arguments over as a JSON string; Anthropic as a parsed object.
function normalizeArgs(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  if (raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return null;
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function asBucket(v: unknown): Bucket | undefined {
  return typeof v === "string" && (BUCKETS as readonly string[]).includes(v)
    ? (v as Bucket)
    : undefined;
}

// ── Provider renderers ───────────────────────────────────────────────────────

export function buildAssistantTools(
  categoryNames: string[],
  includeWrites = false,
) {
  return buildToolCatalog(categoryNames, includeWrites).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object" as const,
      properties: t.properties,
      required: t.required,
    },
  }));
}

export function buildOpenAiTools(categoryNames: string[]) {
  return buildToolCatalog(categoryNames).map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: t.properties,
        required: t.required,
        additionalProperties: false,
      },
    },
  }));
}
