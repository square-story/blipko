# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Commands

Package manager is **pnpm** throughout.

### Backend (root)

```bash
pnpm dev              # ts-node-dev watch mode (src/app.ts)
pnpm build            # tsc → dist/
pnpm start            # node dist/app.js
pnpm lint             # eslint
pnpm prisma:migrate   # prisma migrate dev (applies pending migrations)
pnpm prisma:generate  # regenerate Prisma client after schema changes
pnpm db:seed          # compile + run prisma/seed.ts
pnpm webhook:set      # register the Telegram webhook (needs TELEGRAM_BOT_TOKEN, WEBHOOK_URL, TELEGRAM_WEBHOOK_SECRET)
```

### Testing

```bash
# Unit tests (vitest) — src/**/*.spec.ts
pnpm test:unit

# Run a single unit test file
pnpm test:unit src/application/use-cases/ProcessIncomingMessage.spec.ts

# E2E / API tests (Playwright) — tests/*.spec.ts
# Playwright auto-starts the backend via webServer config
pnpm test
```

Unit tests use **vitest** with vi mocks. The Playwright suite (`tests/api.spec.ts`) tests HTTP endpoints against a live server and uses `.env.example` for env vars.

`tsconfig.json` **excludes `**/*.spec.ts`**, so `tsc --noEmit` does not typecheck
tests — a spec can be badly typed and still pass CI's build step. Run
`pnpm test:unit` too.

AI provider SDKs are mocked at the module boundary (`vi.mock("openai")`,
`vi.mock("@anthropic-ai/sdk")`) with `vi.hoisted()` for the shared spy — `vi.mock`
is lifted above the file, so a plain top-level `const` does not exist when the
factory runs. `src/config/env.ts` parses `process.env` at import and is mocked in
specs that pull in a provider.

### Environment

`src/config/env.ts` validates everything at boot and **exits** on a bad value.
`GEMINI_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`, `TELEGRAM_*` are required.
Optional: `OPENAI_PARSER_MODEL`, `SARVAM_API_KEY`, and the assistant lane
(`ASSISTANT_ENABLED`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) which default to
off/blank so a missing key degrades instead of breaking boot.

### Frontend (`web/`)

```bash
cd web
pnpm dev      # Next.js dev server
pnpm build    # Next.js production build
pnpm lint     # eslint
```

The web `postinstall` runs `scripts/sync-prisma-schema.mjs` then `prisma generate`, so the Prisma client in `web/` always reflects the root `../prisma/schema.prisma`.

---

## Architecture

### Two separate runtimes

```
blipko/          ← Backend: Node.js + Express + Prisma (TypeScript, CommonJS)
└── web/         ← Frontend: Next.js 15 App Router (TypeScript, ESM)
```

Both read the **same** `prisma/schema.prisma`. The web app accesses the DB directly via `web/src/lib/prisma.ts` (Next.js Server Actions) — there is no REST layer between them.

**Product:** a personal budget tracker driven over **Telegram**. The user texts what they spend ("chai 30"); the bot categorizes it into a budget bucket and nudges them as budgets fill up. A Next.js dashboard visualizes the same data.

### Backend: Clean Architecture layers

```
domain/          ← Pure interfaces and entity types. No imports from outer layers.
  entities/      ← ParsedData (Zod schema + ParsedIntent / Bucket literals)
                   PendingAction (Zod payload schemas for proposed writes)
  repositories/  ← I*Repository interfaces
  services/      ← IAiParser, IFinancialQueryAgent, IFinancialDataTools,
                   IAssistantAgent, IAssistantWriteTools
  categoryTemplate.ts  ← default category taxonomy used by onboarding

application/     ← Use cases. Depends only on domain interfaces.
  interfaces/    ← IMessagingPlatform (platform-agnostic send/edit)
  use-cases/
    ProcessIncomingMessage.ts   ← Main orchestrator
    ProcessVoiceMessage.ts      ← Transcribes audio then delegates
    PostRecurringCharges.ts     ← Posts due recurring rules as expenses/income
    SendBudgetNudges.ts         ← Dosage-aware budget reminder nudges
    budgetMath.ts, suggestCategoryBudgets.ts  ← budget helpers
    actCallback.ts, txnCallback.ts  ← callback_data grammars
    query/                      ← FinancialDataTools (reads), AssistantWriteTools (proposals)
    processors/                 ← One processor per parsed intent / command

data/            ← Concrete implementations. Only layer that imports Prisma.
  repositories/  ← Prisma*Repository classes
  ai/            ← GeminiParser, OpenAIParser, FallbackAiParser, budgetParserPrompt,
                   ClaudeAssistantAgent, OpenAiQueryAgent, assistantTools,
                   historyTrimmer, groundingCheck, SarvamTranscriptionService
  messaging/     ← TelegramMessageService, TelegramMediaService

presentation/    ← Express routes + controllers (TelegramWebhookController)
```

### Message processing flow

```
Telegram webhook (POST /api/webhooks/telegram)
  → TelegramWebhookController   (idempotency: ProcessedMessage written here)
  → ProcessIncomingMessageUseCase.execute()
      1. ensureUserExists()        — handles `/start <linkToken>` web↔bot linking
      2. Load recent conversation history (last 6 rows)
      3. preParseProcessors  — first canHandle() wins, NO AI
      4. aiParser.parseText(text, { categories, history, today, assistantMode })
      5. postParseProcessors — first canHandle() wins
      → recordExchange() on BOTH paths (fire-and-forget)
```

`today` is `YYYY-MM-DD` in the **user's** timezone. Never derive it inside a parser
from `toISOString()` — a UTC date tells an IST user it is yesterday every evening
after 18:30.

**Processors** (`src/application/use-cases/processors/`), implement `MessageProcessor`.

Pre-parse (button callbacks and commands — run before AI):

| Processor | Handles |
|---|---|
| `PendingActionProcessor` | `act:<id>:y\|n` — confirms an assistant-proposed write (only when the assistant lane is on) |
| `TransactionActionProcessor` | `txn:` callbacks — delete/edit/restore |
| `CarryPromptProcessor` | `car:` — cycle-start carry-forward (savings / opening balance) |
| `CarryAmountProcessor` | a bare number, but only while a `CARRY_AMOUNT` `PendingAction` is live |
| `ConfirmBucketProcessor` | `bkt:` inline-keyboard bucket disambiguation |
| `RecurringConfirmProcessor` | `rec:` recurring confirm buttons |
| `ConnectAccountProcessor` | hands unlinked users to the web dashboard |
| `SettingsProcessor` | `/settings` — income, notification dosage |
| `HelpProcessor` | `/help` |
| `StatusProcessor` | `/status` — budget health, safe daily spend |
| `ReportProcessor` | `/report` — monthly summary |
| `BoxCommandProcessor` | `/boxes` |
| `RecurringCommandProcessor` | `/recurring` |
| `UndoProcessor` | plain `undo` |

Post-parse (dispatched on `ParsedData.intent`):

| Processor | Intent |
|---|---|
| `TransactionReplyProcessor` | reply-to-confirmation → edit/delete |
| `AssistantProcessor` | `ESCALATE`, `QUERY` — yields when the lane is off |
| `StatusProcessor` | `STATUS` |
| `UndoProcessor` | `UNDO` |
| `BatchProcessor` | ≥2 parsed transactions |
| `ExpenseProcessor` | `EXPENSE` |
| `IncomeProcessor` | `INCOME` |
| `RecurringSetupProcessor` | `RECURRING` |
| `BoxProcessor` | `BOX` |
| `QueryProcessor` | `QUERY` (legacy path, `OpenAiQueryAgent`) |
| `FallbackProcessor` | everything else (`canHandle` always true) |

### AI parsing

`FallbackAiParser` chains **OpenAI → Gemini → hard-coded `UNKNOWN` stub**, one
attempt each, 12s timeout per provider. `GeminiParser` and `OpenAIParser` both use
structured output; results are validated against `ParsedBatchSchema` (Zod) in
`domain/entities/ParsedData.ts`. A Zod throw cascades to the next provider.

**Intents:** `EXPENSE`, `INCOME`, `UNDO`, `STATUS`, `RECURRING`, `QUERY`, `BOX`, `ESCALATE`, `UNKNOWN`.
**Buckets:** `NEEDS`, `WANTS`, `SAVINGS` (50/30/20-style budgeting).

The parser has **two prompt modes**, selected by `ctx.assistantMode`
(`budgetParserPrompt.ts`):

- **off** — today's full 8-intent taxonomy, routed to the deterministic processors.
- **on** — log-or-escalate only. It emits `EXPENSE`/`INCOME` for a clear spend and
  `ESCALATE` for everything else. Classifying eight ways is where mis-parses came
  from; when the lane is on, that job no longer exists.

### The assistant lane

Gated on `ASSISTANT_ENABLED` **and** a non-empty `ANTHROPIC_API_KEY`. Off → the
parser stays in 8-intent mode, `AssistantProcessor` yields, and `QueryProcessor`
answers as before. There is no half-on state.

`ClaudeAssistantAgent` is a tool-calling loop (max 5 rounds) with prompt caching
on the system block. `assistantTools.ts` is the single provider-neutral tool
catalog — both agents render from it, so descriptions and dispatch cannot drift.

**The grounding contract.** Every tool obeys all six; this is what prevents
hallucinated numbers, not the prompt:

1. **Money is pre-formatted.** `formatMoney()` server-side. The model quotes
   strings; it never sees a rupee number it could do arithmetic on.
2. **Verdicts are precomputed.** `check_affordability` returns `YES|TIGHT|NO`,
   `compare_cycles` returns `direction`/`deltaPct`, `get_period_status` returns a
   bucket `status` enum. If the model would need to calculate, there is a tool.
3. **Schemas carry the user's real data.** `category` params are an `enum` built
   per request from the user's own leaf categories, so an invented category cannot
   even be asked about.
4. **Tools never throw.** Failures return `{ ok: false, error, ...options }` so the
   model self-corrects inside the 5-round budget. A throw would kill the turn with
   no model-visible recovery.
5. **Absence ≠ zero.** Empty results carry an explicit `note`. "Nothing logged" is
   never reported as "spent ₹0".
6. **One timezone, inclusive end dates.** Tool dates are `YYYY-MM-DD` in the user's
   timezone and `to` is **inclusive** — exclusive end dates are an off-by-one trap
   for an LLM.

`groundingCheck.ts` then extracts every `₹` figure from the answer and asserts it
appears in some tool result. Misses are logged as `grounding_miss` — hallucination
is measured, not assumed away.

**Writes are proposals.** The agent's `propose_*` tools mutate nothing: each
resolves its references against real rows, then records a `PendingAction` and
returns a summary. `AssistantProcessor` renders `act:<id>:y|n` buttons;
`PendingActionProcessor` re-checks ownership, expiry (30 min), single-use and Zod
payload shape, then performs the write. Add new write tools this way — never let
the agent touch a repository directly.

`historyTrimmer.ts` drops whole exchanges from the oldest end and never splits a
`tool_use` from its `tool_result` (an orphan is rejected by the API).

**Product questions are grounded too.** The assistant may discuss the user's money
*and* Blipko itself — nothing else. Product answers come from
`src/domain/productFacts.ts` via `get_product_info`, never from model knowledge: an
invented feature sends the user hunting for something that does not exist.

**Update `productFacts.ts` when you ship or remove a user-facing feature.** It is
the file the bot speaks from, and it is deliberately *not* generated from
`README.md` — the README currently still describes the in-chat onboarding wizard
that `ConnectAccountProcessor` replaced with a dashboard hand-off, and omits
`/boxes`. Keep it in sync with the code.

`open_dashboard` returns a URL that `AssistantProcessor` renders as a button (a
pending write takes precedence over it). Every dashboard link — assistant, `/help`,
the connect hand-off — comes from `env.WEB_APP_URL`, never a hardcoded domain.

### Frontend: Server Actions pattern

All data fetching/mutations in `web/` use **Next.js Server Actions** in `web/src/lib/actions/` — no custom API routes. Prisma is called directly (`web/src/lib/prisma.ts`).

Actions: `analytics.ts`, `budget.ts`, `categories.ts`, `expenses.ts`, `income.ts`, `recurring.ts`, `user.ts`. Dashboard pages live under `web/src/app/dashboard/` (analytics, categories, expenses, income, recurring, account, …).

### Idempotency

Every incoming Telegram update ID is written to `ProcessedMessage` (in `TelegramWebhookController`) before processing. Duplicate deliveries are silently dropped.

### Schema highlights (`prisma/schema.prisma`)

- Core financial models: `Expense`, `Income`, `BudgetConfig` (per-bucket + per-category budgets), `Category` (user taxonomy), `RecurringRule`.
- `User.carryDecidedKey` — the cycle key (`periodKey`, a cycle start date) the
  user last settled the carry-forward prompt for. Written by a conditional
  `updateMany` so the Telegram buttons and the dashboard modal cannot both carry
  the same leftover.
- `BudgetNudge` + `NotificationDosage` enum (`OFF | GENTLE | AGGRESSIVE | RELENTLESS`) — dosage-aware reminders; sent by `SendBudgetNudges`.
- `Bucket` enum: `NEEDS | WANTS | SAVINGS`. `ExpenseSource`, `NudgeKind`, `RecurringKind` enums.
- `ConversationMessage` — rolling chat history fed back to the AI. Ordered by
  `seq` (a Postgres sequence), **never `createdAt`**: two turns written in the same
  millisecond tie, and the transcript comes back scrambled. Written via
  `appendExchange()` as one `createMany` so a user turn can never be read back
  after its own reply. Also carries `intent`, `entityRefs`, `toolCalls`, and
  per-turn `provider`/`model`/`latencyMs`/`inputTokens`/`outputTokens`/`costUsd`.
- `PendingAction` — a write the assistant proposed but has not performed
  (`kind`, Zod-validated `payload`, `summary`, `expiresAt`, `consumedAt`).
- `ProcessedMessage` — idempotency ledger. `ParseLog` — raw parser audit.
- `TelegramLinkToken` — short-lived token linking a web account to a Telegram chat (`/start <token>`).
- `Account` / `Session` / `VerificationToken` are **NextAuth** models (web auth), not financial accounts.
