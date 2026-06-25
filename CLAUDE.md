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
  repositories/  ← I*Repository interfaces
  services/      ← IAiParser, IFinancialQueryAgent, IFinancialDataTools
  categoryTemplate.ts  ← default category taxonomy used by onboarding

application/     ← Use cases. Depends only on domain interfaces.
  interfaces/    ← IMessagingPlatform (platform-agnostic send/edit)
  use-cases/
    ProcessIncomingMessage.ts   ← Main orchestrator
    ProcessVoiceMessage.ts      ← Transcribes audio then delegates
    PostRecurringCharges.ts     ← Posts due recurring rules as expenses/income
    SendBudgetNudges.ts         ← Dosage-aware budget reminder nudges
    budgetMath.ts, suggestCategoryBudgets.ts  ← budget helpers
    processors/                 ← One processor per parsed intent / command

data/            ← Concrete implementations. Only layer that imports Prisma.
  repositories/  ← Prisma*Repository classes
  ai/            ← GeminiParser, OpenAIParser, FallbackAiParser,
                   OpenAiQueryAgent, SarvamTranscriptionService, budgetParserPrompt
  messaging/     ← TelegramMessageService, TelegramMediaService

presentation/    ← Express routes + controllers (TelegramWebhookController)
```

### Message processing flow

```
Telegram webhook (POST /api/webhooks/telegram)
  → TelegramWebhookController   (idempotency: ProcessedMessage written here)
  → ProcessIncomingMessageUseCase.execute()
      1. ensureUserExists()        — handles `/start <linkToken>` web↔bot linking
      2. Load recent conversation history (last 6 turns)
      3. preParseProcessors  — first canHandle() wins, NO AI
      4. aiParser.parseText(text, { categories, history }) → ParsedData
      5. postParseProcessors — first canHandle() wins
         (conversation turns saved fire-and-forget after a post-parse handle)
```

**Processors** (`src/application/use-cases/processors/`), implement `MessageProcessor`.

Pre-parse (button callbacks, commands, onboarding — run before AI):

| Processor | Handles |
|---|---|
| `ConfirmBucketProcessor` | inline-keyboard bucket disambiguation replies |
| `RecurringConfirmProcessor` | recurring income/expense confirm buttons |
| `OnboardingProcessor` | multi-step wizard: income → category groups → reminder dosage |
| `SettingsProcessor` | settings (e.g. notification dosage) |
| `HelpProcessor` | `/help` |
| `StatusProcessor` | `/status` — budget health, safe daily spend |
| `ReportProcessor` | `/report` — monthly summary |
| `UndoProcessor` | undo last entry |

Post-parse (dispatched on `ParsedData.intent`):

| Processor | Intent |
|---|---|
| `StatusProcessor` | `STATUS` |
| `UndoProcessor` | `UNDO` |
| `ExpenseProcessor` | `EXPENSE` |
| `IncomeProcessor` | `INCOME` |
| `RecurringSetupProcessor` | `RECURRING` |
| `QueryProcessor` | `QUERY` (delegates to `OpenAiQueryAgent`) |
| `FallbackProcessor` | everything else (`canHandle` always true) |

### AI parsing

`GeminiParser` uses Gemini structured output (`responseMimeType: "application/json"` + `responseSchema`). `OpenAIParser` mirrors the interface. `FallbackAiParser` chains them: Gemini → OpenAI → hard-coded fallback. Parser output is validated against `ParsedDataSchema` (Zod) in `domain/entities/ParsedData.ts`; the user's existing categories are passed in as hints.

**Intents:** `EXPENSE`, `INCOME`, `UNDO`, `STATUS`, `RECURRING`, `QUERY`, `UNKNOWN`.
**Buckets:** `NEEDS`, `WANTS`, `SAVINGS` (50/30/20-style budgeting).

`QUERY` is handled by a separate agent (`OpenAiQueryAgent` / `IFinancialQueryAgent`) with data-access tools, not by the structured parser.

### Frontend: Server Actions pattern

All data fetching/mutations in `web/` use **Next.js Server Actions** in `web/src/lib/actions/` — no custom API routes. Prisma is called directly (`web/src/lib/prisma.ts`).

Actions: `analytics.ts`, `budget.ts`, `categories.ts`, `expenses.ts`, `income.ts`, `recurring.ts`, `user.ts`. Dashboard pages live under `web/src/app/dashboard/` (analytics, categories, expenses, income, recurring, account, …).

### Idempotency

Every incoming Telegram update ID is written to `ProcessedMessage` (in `TelegramWebhookController`) before processing. Duplicate deliveries are silently dropped.

### Schema highlights (`prisma/schema.prisma`)

- Core financial models: `Expense`, `Income`, `BudgetConfig` (per-bucket + per-category budgets), `Category` (user taxonomy), `RecurringRule`.
- `BudgetNudge` + `NotificationDosage` enum (`OFF | GENTLE | AGGRESSIVE | RELENTLESS`) — dosage-aware reminders; sent by `SendBudgetNudges`.
- `Bucket` enum: `NEEDS | WANTS | SAVINGS`. `ExpenseSource`, `NudgeKind`, `RecurringKind` enums.
- `ConversationMessage` — rolling chat history fed back to the AI parser.
- `ProcessedMessage` — idempotency ledger. `ParseLog` — raw parser audit.
- `TelegramLinkToken` — short-lived token linking a web account to a Telegram chat (`/start <token>`).
- `Account` / `Session` / `VerificationToken` are **NextAuth** models (web auth), not financial accounts.
