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
pnpm dev              # ts-node-dev watch mode
pnpm build            # tsc → dist/
pnpm start            # node dist/app.js
pnpm lint             # eslint
pnpm prisma:migrate   # prisma migrate dev (applies pending migrations)
pnpm prisma:generate  # regenerate Prisma client after schema changes
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

The web `postinstall` script runs `prisma generate` pointing at `../prisma/schema.prisma`, so the Prisma client in `web/` always reflects the root schema.

---

## Architecture

### Two separate runtimes

```
blipko/          ← Backend: Node.js + Express + Prisma (TypeScript, CommonJS)
└── web/         ← Frontend: Next.js 15 App Router (TypeScript, ESM)
```

Both read the **same** `prisma/schema.prisma`. The web app accesses the DB directly via `web/src/lib/prisma.ts` (Next.js Server Actions) — there is no REST layer between them.

### Backend: Clean Architecture layers

```
domain/          ← Pure interfaces and entity types. No imports from outer layers.
  entities/      ← ParsedData, Transaction (domain types, not Prisma types)
  repositories/  ← I*Repository interfaces + DTOs
  services/      ← IAiParser interface

application/     ← Use cases. Depends only on domain interfaces.
  use-cases/
    ProcessIncomingMessage.ts   ← Main orchestrator
    ProcessVoiceMessage.ts      ← Transcribes audio then delegates
    processors/                 ← One processor per parsed intent

data/            ← Concrete implementations. Only layer that imports Prisma.
  repositories/  ← Prisma*Repository classes
  ai/            ← GeminiParser, OpenAIParser, FallbackAiParser, SarvamTranscriptionService
  messaging/     ← WhatsAppMessageService, WhatsAppMediaService

presentation/    ← Express routes and controllers
```

### Message processing flow

```
WhatsApp webhook
  → WebhookController
  → ProcessIncomingMessageUseCase.execute()
      1. ensureUserExists()           (IUserRepository)
      2. Check quick-reply keywords   (no AI)
      3. Try StartProcessor / ConfirmationProcessor without AI
      4. GeminiParser.parseText()     → ParsedData
      5. Iterate processors, first canHandle() wins
```

**Processors** (`src/application/use-cases/processors/`):

| Processor | Intent(s) handled |
|---|---|
| `ConfirmationProcessor` | Confirmation button replies |
| `StartProcessor` | `/start`, first message |
| `ReplyProcessor` | User replies to a confirmation message |
| `UndoProcessor` | `UNDO` |
| `ChatProcessor` | `CHAT` |
| `QueryProcessor` | `QUERY` (CONTACT_BALANCE, UNPAID_CONTACTS, TOTAL_SPEND, …) |
| `BalanceProcessor` | `BALANCE` |
| `TransactionProcessor` | `CREDIT`, `DEBIT` |
| `DailySummaryProcessor` | `VIEW_DAILY_SUMMARY` |

### AI parsing

`GeminiParser` uses Gemini's structured output (JSON schema enforcement) with `responseMimeType: "application/json"` and `responseSchema`. The schema is defined inline in `GeminiParser.ts`. `OpenAIParser` mirrors the same interface. `FallbackAiParser` chains them: Gemini → OpenAI → hard-coded fallback.

CREDIT = money leaving the user (paid, lent). DEBIT = money coming in (received, earned). This is the inverse of accounting convention — it reflects the user's perspective.

All contact name lookups from AI-parsed text **must** go through `findSimilarByName()` (Levenshtein + honorific normalization), never raw `findByName()`.

### Frontend: Server Actions pattern

All data fetching and mutations in `web/` use **Next.js Server Actions** in `web/src/lib/actions/`. There are no custom API routes in the frontend. Prisma is called directly from Server Actions.

Key actions: `dashboard.ts` (overview stats), `analytics.ts` (monthly trend, overdue, category breakdown), `transactions.ts`, `vendors.ts`.

### Idempotency

Every incoming WhatsApp message ID is written to `ProcessedMessage` before processing. Duplicate deliveries are silently dropped.

### Schema highlights

- `LedgerAccount` + `TransactionLine` — double-entry accounting (not yet wired to transaction creation, schema is ready)
- `Organization` + `BusinessUnit` — optional FKs on `Contact`; existing single-user flow is unaffected
- `RecurringCharge` → `DueEntry` — periodic billing (BullMQ job not yet wired)
- `AuditLog` — schema present; repository writes not yet instrumented
- `Account` in the schema is **NextAuth's OAuth account model**, not a financial account

### Active branch

`refactor/double-entry` — extended schema (LedgerAccount, TransactionLine, Organization, BusinessUnit, RecurringCharge, DueEntry, Deposit, Contribution, AuditLog), implemented QueryProcessor, extended GeminiParser query schema, implemented analytics dashboard page.
