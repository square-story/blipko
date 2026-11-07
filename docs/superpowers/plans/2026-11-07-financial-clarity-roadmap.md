# Financial Clarity Roadmap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Blipko from "expense logger" to a financial clarity product. Every cycle should answer *where did my money go, does it make sense, what should I do differently*, and close the loop on last cycle's answer. Blipko should speak up **during** the cycle, and capture should need less and less from the user.

**Architecture:** Seven phases. Each phase is one PR to `main` → Railway deploy → changelog entry → `productFacts.ts` update. Phases 1–3 are fully specified below. Phases 4–7 are scoped, and get their own detailed plan in `docs/superpowers/plans/` when started. New logic goes in pure functions beside the existing code (`budgetMath.ts`, `cycleReport.ts`, a new `cycleInsights.ts`) so it can be unit-tested without a database.

**Tech Stack:** Node/Express/Prisma backend (vitest `pnpm test:unit`), Next.js 15 web (Server Actions, shadcn, web vitest for Prisma-free modules only), Telegram.

**Spec:** two research write-ups by Simile Mishra, both pasted in this conversation:
- **A.** Secondary research: 14 apps, reviews and forums.
- **B.** Primary research: 7 interviews, 3 personas (Aditi, Arjun, Rahul).

Also the gap analysis given before the first plan draft.

## Context

**Both studies say the same thing:** money is spread across UPI apps, cards, wallets and subscriptions. Piecing it together *after the fact* is so tiring that people quit, and confidence in "knowing where my money goes" tops out at 50–70% (B).

**B adds evidence A didn't have:**
1. Small, frequent purchases are the biggest blind spot.
2. Manual entry gets abandoned within days ("I don't need extra work").
3. Subscriptions are forgotten "until the charge actually goes".
4. Splitting costs with friends (Arjun) and irregular income (Rahul) are separate layers of difficulty.
5. The monthly summary must "close the loop instead of resetting to zero".
6. "I don't need more guilt. I need clarity."

**What Blipko already has:** chat logging (which lowers manual-entry cost), nudges, a cycle report, an assistant that quotes only real numbers, and recurring rules.

**Gaps → phase that fixes it:**

| Gap | Phase |
|---|---|
| Report never says "does it make sense" or "what next", and never revisits last cycle's advice | 2 |
| No measure of whether users actually feel clearer | 2 |
| Wording that shames ("leaks", "Net overspent", "❌ over") | 2 |
| Check-ins don't project ahead, don't catch quiet days, don't warn before a subscription charge | 3 |
| No data export or self-delete; orphaned parse logs (DPDP) | 1 |
| No investment-advice rule (SEBI) | 1 |
| Capture still needs a typed message for every spend | 4 |
| Subscriptions aren't detected | 5 |
| Unlogged money stays invisible | 6 |
| Statements can't be imported | 7 |

**Decisions confirmed with the user:**
- Detail the near phases now and re-plan later phases when reached.
- Account delete is a **hard delete of everything**, with export offered first.
- Reminder frequency is already asked during setup (`web/src/components/onboarding.tsx:68`, GENTLE preselected). No work needed.

**What B changed in this plan:**
- Added: closing the loop (2.2), a confidence score (2.3), a quiet-day prompt (3.2) and an upcoming-charge heads-up (3.3).
- Capture now comes **before** balance reconciliation (capture is Phase 4; reconciliation was Phase 3 and is now Phase 6). B shows the low point is the reconstruction itself, so removing it beats reconciling after it.
- Capture gained **auto-forwarding** of bank SMS, so nothing has to be typed.
- Splitting and freelancer needs are listed as "later — your call".

## Phase map

| Phase | Theme | Evidence | Size |
|---|---|---|---|
| **1** | Trust & legal: export, delete, advice guardrail | A: legal layer | S |
| **2** | Monthly clarity loop: insights + one action, follow-up on last cycle's action, confidence score, non-shaming tone | A: central question · B: "close the loop", 50–70% confidence, "no more guilt" | M |
| **3** | In-the-moment check-ins: pace projection, quiet-day prompt, tomorrow's subscription charges | A: "retrospective only" · B: small purchases, forgotten subscriptions | S |
| 4 | Capture: paste/forward bank & UPI alerts, then **auto-forward** with no typing | A+B: fragmentation · B: manual entry abandoned | M–L |
| 5 | Subscription detection from history | B finding 3 | M |
| 6 | Balance reconciliation ("₹4,200 isn't accounted for") | A: opening scene | M |
| 7 | Statement upload (CSV first) | Fragmentation at scale | L |
| Later — your call | Splits / who-owes-whom (Arjun) · Freelancer mode: work vs personal, budget from income received (Rahul) · Account Aggregator (FIU registration) | B finding 6 | M–XL each |

**How each phase rolls out:**
1. Branch `feat/<phase-slug>` and open a PR. CI runs build, lint and `pnpm test:unit`. Follow the gh account-switch memory note.
2. Merge, then Railway deploys. Migrations run through `prisma migrate deploy`; check the web schema sync (railway memory note).
3. Add a changelog entry `web/content/changelog/YYYY-MM-DD-<name>.mdx` and register it in `web/src/lib/changelog.ts` (`import * as x` plus the `modules` array).
4. Update `src/domain/productFacts.ts` so the bot can describe the change.
5. Run the phase's prod smoke check, then start the next phase.

## Success metrics (read monthly from prod)

1. **Clarity score** (north star, starts in Phase 2): average 1–5 answer to "how sure are you about where your money went?" per cycle. B's interview baseline is 50–70%, roughly 3/5.
   `SELECT "cycleKey", round(avg(score),2), count(*) FROM "ClarityScore" GROUP BY 1 ORDER BY 1;`
2. **Logging days:** the share of a user's days with at least one expense. This is the abandonment signal from B finding 4.
   `SELECT "userId", count(DISTINCT date_trunc('day', date)) FROM "Expense" WHERE date > now() - interval '30 days' AND NOT "isDeleted" GROUP BY 1;`
3. **Auto-captured share** (after Phase 4): `source = 'SMS'` divided by all expenses.

## Global Constraints

- Money in user-facing text always goes through `formatMoney()` (`src/application/use-cases/budgetMath.ts:118`). Category names and notes go through `sanitizeMd()`.
- Dates are in the **user's** timezone (`user.timezone`, default `Asia/Kolkata`). Never derive a date from `toISOString()`.
- Grounding contract (CLAUDE.md, assistant lane): figures are computed server-side. Neither model nor copy does arithmetic the code didn't.
- Edit only the root `prisma/schema.prisma`.
- Dashboard links come from `env.WEB_APP_URL`.
- No new dependencies in Phases 1–3.
- No AI attribution in commits (memory note).

## Review Focus

1. **Export leaking secrets.** The JSON export must not contain NextAuth `Account` tokens, `Session.sessionToken` or `TelegramLinkToken.token`. Pinned in Task 1.1.
2. **A user with little or no history.** No baseline cycles means no "unusual" line and no follow-up line. `nextCycleAction` still returns its fallback. Pinned in Tasks 2.1 and 2.2.
3. **Pace projection on day 1–2 or with ₹0 spent.** Must not divide by zero or project from one purchase. Pinned in Task 3.1.
4. **Tapping a confidence button twice, or on an old report's buttons.** Must give one score per cycle (last tap wins), with no crash and no duplicate row. Pinned in Task 2.3 (upsert key plus a repeat-tap test).
5. **Deleting a user with a linked Telegram chat.** The next bot message must create a fresh user, not crash. Manual check in Task 1.2.

---

## Phase 1 — Trust & legal

### Task 1.1: Data export (JSON) on the account page

**Files:**
- Create: `web/src/lib/export-redact.ts`, `web/src/lib/export-redact.spec.ts`
- Modify: `web/src/lib/actions/user.ts` (add `exportMyData`)
- Create: `web/src/app/dashboard/account/data-card.tsx`
- Modify: `web/src/app/dashboard/account/page.tsx:20-22` (render `<DataCard />` after `<TelegramCard />`)

**Interfaces:**
- Produces:
  - `redactExport<T extends Record<string, unknown>>(user: T): Omit<T, "accounts" | "sessions" | "telegramLinkTokens">`
  - `exportMyData(): Promise<{ success: boolean; json?: string; message?: string }>`

- [ ] **Step 1: Write the failing test** in `web/src/lib/export-redact.spec.ts`:

```ts
it("drops auth secrets and link tokens but keeps financial data", () => {
  const out = redactExport({
    id: "u1", email: "a@b.c",
    accounts: [{ access_token: "x", refresh_token: "y" }],
    sessions: [{ sessionToken: "s" }],
    telegramLinkTokens: [{ token: "t" }],
    expenses: [{ amount: "30.00" }],
  });
  const s = JSON.stringify(out);
  expect(s).not.toMatch(/access_token|refresh_token|sessionToken|"token"/);
  expect(out).toMatchObject({ id: "u1", expenses: [{ amount: "30.00" }] });
});
```

- [ ] **Step 2:** Run `cd web && pnpm test src/lib/export-redact.spec.ts`. Expected: FAIL, `redactExport` not defined.
- [ ] **Step 3: Implement `redactExport`.** Destructure the three keys out and return the rest.
- [ ] **Step 4: Implement `exportMyData()`.**
  - Use the `auth()` guard as in the other actions in `user.ts`.
  - Call `prisma.user.findUnique({ where: { id }, include: { …: true } })` over every user-owned relation: expenses, incomes, categories, budget config, recurring rules, boxes (with their entries), conversation messages, parse logs, nudges, pending actions, category memories, income categories. Use the relation names exactly as in the `User` model (`prisma/schema.prisma:63`).
  - Do **not** include `accounts`, `sessions` or `telegramLinkTokens`.
  - Return `JSON.stringify(redactExport(user), null, 2)`.
- [ ] **Step 5: Build `DataCard`.**
  - "Export my data" button, using the `useTransition` + Blob + `<a download>` pattern from `web/src/app/dashboard/expenses/_components/expense-table-toolbar.tsx:33-47`.
  - Filename `blipko-export-YYYY-MM-DD.json`. Toasts from `@/lib/toast`.
- [ ] **Step 6: Verify.**
  - `cd web && pnpm test && pnpm build`. Expected: pass.
  - Manual: /dashboard/account, then Export. The file has expenses and no `access_token`.
- [ ] **Step 7: Commit.** `feat(web): export all my data as JSON`

### Task 1.2: Account self-delete (hard delete)

**Files:**
- Modify: `prisma/schema.prisma:455` (`ParseLog.user` gets `onDelete: Cascade`), plus migration `parselog_cascade_user`
- Modify: `web/src/lib/actions/user.ts` (add `deleteMyAccount`)
- Modify: `web/src/app/dashboard/account/data-card.tsx` (Delete button)

**Interfaces:**
- Produces: `deleteMyAccount(): Promise<{ success: boolean; message?: string }>`

Why a cascade: ParseLog is currently `ON DELETE SET NULL`, which leaves the user's raw message text with no owner. A database rule covers every future delete path, not just this one.

- [ ] **Step 1:** Add `onDelete: Cascade` to the `ParseLog.user` relation. Run `pnpm prisma:migrate` (name `parselog_cascade_user`), then `pnpm prisma:generate`. Expected: the migration SQL re-adds the FK with `ON DELETE CASCADE`.
- [ ] **Step 2: Implement `deleteMyAccount()`.**
  - `auth()` guard.
  - `prisma.$transaction([prisma.verificationToken.deleteMany({ where: { identifier: email } }), prisma.user.delete({ where: { id } })])`.
  - Then `await signOut({ redirectTo: "/" })` from `@/auth` (`web/src/auth.ts:7`).
- [ ] **Step 3: Add the Delete button.**
  - Wrap it in `ConfirmDialog` (`web/src/components/confirm-dialog.tsx`), following the pattern at `telegram-card.tsx:58-67`.
  - Title "Delete your account?". Description "This permanently erases every expense, income, category, box, chat history and log. It can't be undone. Export your data first if you want a copy." confirmLabel "Delete everything".
- [ ] **Step 4: Verify on the local DB.**
  - Use a throwaway login with 2 expenses, then delete.
  - Expected: `SELECT count(*) FROM "Expense" WHERE "userId"='<id>'` gives 0, and the same query on `"ParseLog"` gives 0.
  - Message the bot from the old linked chat. Expected: the connect hand-off reply, no crash.
- [ ] **Step 5: Commit.** `feat(web): let users delete their account and all data`

### Task 1.3: Investment-advice guardrail + docs

**Files:**
- Modify: `src/data/ai/ClaudeAssistantAgent.ts:271`, `src/data/ai/OpenAiQueryAgent.ts:117`
- Test: `src/data/ai/ClaudeAssistantAgent.spec.ts`, `src/data/ai/OpenAiQueryAgent.spec.ts` (next to the existing "Today: 2026-08-11" prompt tests)
- Modify: `src/domain/productFacts.ts` (`dataHandling`)
- Create: `web/content/changelog/<date>-your-data-your-call.mdx`, registered in `web/src/lib/changelog.ts`

Exact copy to append to both scope rules:
> `Never recommend specific investments, funds, stocks, insurance or tax strategies — you are not a registered adviser. You may describe the user's own savings figures; for advice, suggest a SEBI-registered investment adviser.`

- [ ] **Step 1: Write failing tests.** In each spec, `expect(system).toContain("SEBI-registered investment adviser")`, extracting `system` the same way as the existing date-anchor test.
- [ ] **Step 2:** `pnpm test:unit src/data/ai/ClaudeAssistantAgent.spec.ts src/data/ai/OpenAiQueryAgent.spec.ts`. Expected: 2 FAIL.
- [ ] **Step 3:** Append the copy to both prompts and re-run. Expected: PASS.
- [ ] **Step 4: Update `productFacts.ts`.**
  - `dataHandling` gets `"Export everything Blipko stores about you as a file from the dashboard's Account page."` and `"Delete your account from the Account page — every expense, message and log is erased permanently."`
  - Run `pnpm test:unit src/data/ai/productTools.spec.ts`. Expected: PASS.
- [ ] **Step 5:** Add the changelog MDX (`slug: "your-data-your-call"`, tags `["Feature"]`). Run `cd web && pnpm build`. Expected: pass.
- [ ] **Step 6: Commit.** `feat: decline investment advice; document export and delete`

**Phase 1 prod smoke:** export from prod; ask the bot "which mutual fund should I buy?" and expect a decline that names a SEBI-registered adviser.

---

## Phase 2 — Monthly clarity loop

### Task 2.1: The report flags unusual spends and ends with one action

**Files:**
- Create: `src/application/use-cases/cycleInsights.ts` (pure), `src/application/use-cases/cycleInsights.spec.ts`
- Modify: `src/application/use-cases/cycleReport.ts`
  - `:165`: fetch 5 cycles
  - `:114-153`: `movers` becomes pure over pre-fetched totals
  - `:244-246`: append lines
- Test: `src/application/use-cases/cycleReport.spec.ts` (the `categoryTotals` mock must key on month; today it only tells ended from not-ended)

**Interfaces:**
- Produces, in `cycleInsights.ts`:
  - `type CatTotal = { name: string; total: number }`
  - `type BucketRow = { bucket: Bucket; spent: number; budget: number }`
  - `type Unusual = { name: string; total: number; usual: number }`
  - `type ActionTarget = { kind: "category"; name: string; limit: number } | { kind: "bucket"; bucket: Bucket } | { kind: "savings" } | { kind: "none" }`
  - `unusualCategories(ended: CatTotal[], baseline: CatTotal[][]): Unusual[]`. A category counts when it appears in ≥2 baseline cycles; `usual` = its mean over the cycles where it appears; it needs `total >= 2 * usual` **and** `total - usual >= 500`. Sorted by `total - usual` descending, at most 2.
  - `nextCycleAction(input: { unusual: Unusual[]; buckets: BucketRow[]; cycleDays: number }): { text: string; target: ActionTarget }`. The **first** matching rule wins:
    1. `unusual[0]` → `💡 Next cycle: keep ${name} near its usual ${formatMoney(usual)} — that frees ${formatMoney(total - usual)}.` with target `{kind:"category", name, limit: usual}`
    2. NEEDS/WANTS with the largest `spent - budget > 0` → `💡 Next cycle: ${label} ran ${formatMoney(spent - budget)} past budget — about ${formatMoney(budget / cycleDays)}/day keeps it on track.` with target `{kind:"bucket", bucket}`
    3. SAVINGS `spent < budget` → `💡 Next cycle: move ${formatMoney(budget - spent)} to savings on payday, before spending starts.` with target `{kind:"savings"}`
    4. Otherwise → `💡 Next cycle: same plan — it worked.` with target `{kind:"none"}`
  - `movers(ended: CatTotal[], prior: CatTotal[]): { up: {name; delta} | null; down: {name; delta} | null }`. Same logic as today, made pure.

- [ ] **Step 1: Write failing tests** in `cycleInsights.spec.ts`:
  - Food Delivery: baseline `[[{name:"Food Delivery",total:1000}],[{name:"Food Delivery",total:1400}]]`, ended `3100` → `[{ name:"Food Delivery", total:3100, usual:1200 }]`
  - usual 40, ended 120 → `[]` (noise floor)
  - present in only 1 baseline cycle → `[]`
  - empty baseline → `[]`
  - `nextCycleAction`: one test per rule 1–4, asserting the exact text and target. Rule 1 text: `"💡 Next cycle: keep Food Delivery near its usual ₹1,200 — that frees ₹1,900."`
- [ ] **Step 2:** `pnpm test:unit src/application/use-cases/cycleInsights.spec.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** using `formatMoney`, `sanitizeMd` and `BUCKET_META` from `./budgetMath`. Move `movers` here as a pure function. Run. Expected: PASS.
- [ ] **Step 4: Rewire `buildCycleReport`.**
  - Fetch `previousCycles(payday, 5, now, tz)`. Then `ended = [0]`, `prior = [1]`, and the ended cycle's baseline is `[1..3]`.
  - Fetch `categoryTotals(user.id, c.start, c.end, null, MOVER_SCAN)` once per cycle, in parallel. Feed `movers(cats[0], cats[1])`.
  - Collect `endedBuckets: BucketRow[]` inside the bucket loop.
  - `cycleDays = Math.round((ended.end.getTime() - ended.start.getTime()) / 86_400_000)`.
  - After the movers block, append:
    - when unusual is non-empty: `\n\nUnusual this cycle: ${u.map(x => \`${name} ${formatMoney(total)} (usually ${formatMoney(usual)})\`).join(" · ")}`
    - always: `\n\n${nextCycleAction(...).text}`
- [ ] **Step 5: Update `cycleReport.spec.ts`.**
  - Make the `categoryTotals` mock return per-month data (May ended, Apr prior, Mar/Feb/Jan baseline).
  - Add `it("adds an unusual line and one next-cycle action")` asserting `"Unusual this cycle:"` and `"💡 Next cycle:"`.
  - Keep `"names the biggest riser and faller"` green.
  - Run `pnpm test:unit src/application/use-cases/cycleReport.spec.ts src/application/use-cases/SendCycleReport.spec.ts`. Expected: PASS.
- [ ] **Step 6: Commit.** `feat(report): flag unusual spends and suggest one next-cycle action`

### Task 2.2: Close the loop on last cycle's action

No storage is needed. Last cycle's action is a pure function of last cycle's data, so it can be recomputed and checked against this cycle.

**Files:**
- Modify: `src/application/use-cases/cycleInsights.ts`, `cycleInsights.spec.ts`, `cycleReport.ts`, `cycleReport.spec.ts`

**Interfaces:**
- Consumes: `ActionTarget`, `nextCycleAction`, `unusualCategories`, `CatTotal`, `BucketRow` (Task 2.1)
- Produces: `followUpLine(target: ActionTarget, ended: { cats: CatTotal[]; buckets: BucketRow[] }): string | null`. Exact copy:
  - category, `actual <= limit * 1.1` (a missing category counts as 0) → `✅ Last cycle's goal — ${name} near ${formatMoney(limit)}: done (${formatMoney(actual)}).`
  - category, otherwise → `↗ Last cycle's goal — ${name} near ${formatMoney(limit)}: came in at ${formatMoney(actual)}.`
  - bucket within budget → `✅ Last cycle's goal — ${label} within budget: done.` Otherwise → `↗ Last cycle's goal — ${label} within budget: ran ${formatMoney(spent - budget)} past.`
  - savings, `spent >= budget` → `✅ Last cycle's goal — savings target: done.` Otherwise → `↗ Last cycle's goal — savings target: short by ${formatMoney(budget - spent)}.`
  - none → `null`

- [ ] **Step 1: Write failing tests.**
  - One per branch above, including Food Delivery limit 1200: actual 1300 → done; actual 2000 → came in at ₹2,000; category missing → done (₹0).
  - `none` → `null`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. Run. Expected: PASS.
- [ ] **Step 4: Wire into `buildCycleReport`.**
  - Compute the prior cycle's effective income: `sumEarnedForMonth` + `sumCarryForMonth` over `prior`, then `effectiveMonthlyIncome`.
  - `priorBuckets: BucketRow[]` uses `prevSpent` (already fetched) and `bucketBudget(priorIncome, config, b)`.
  - `lastTarget = nextCycleAction({ unusual: unusualCategories(cats[1], cats.slice(2, 5)), buckets: priorBuckets, cycleDays: priorDays }).target`.
  - Insert `followUpLine(lastTarget, { cats: cats[0], buckets: endedBuckets })` on its own line right after the headline, when it's non-null.
- [ ] **Step 5: Spec.**
  - `it("reports on last cycle's goal")` with data where April had an unusual category → expect `"Last cycle's goal"`.
  - `it("omits the follow-up with only one prior cycle")` → `not.toContain`.
  - Run the cycleReport and SendCycleReport specs. Expected: PASS.
- [ ] **Step 6: Commit.** `feat(report): follow up on last cycle's suggested action`

### Task 2.3: Clarity score after each cycle report

**Files:**
- Modify: `prisma/schema.prisma`, adding:
  `model ClarityScore { id String @id @default(cuid()); userId String; user User @relation(fields: [userId], references: [id], onDelete: Cascade); cycleKey String; score Int; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt; @@unique([userId, cycleKey]) }`
  plus `clarityScores ClarityScore[]` on User. Migration `clarity_score`.
- Create: `src/domain/repositories/IClarityScoreRepository.ts`, `src/data/repositories/PrismaClarityScoreRepository.ts`
- Create: `src/application/use-cases/clarityCallback.ts` + `.spec.ts`
- Create: `src/application/use-cases/processors/ClarityScoreProcessor.ts` + `.spec.ts`
- Modify: `src/application/use-cases/ProcessIncomingMessage.ts:116-204` (pre-parse, after `RecurringConfirmProcessor`; optional constructor dep like `pendingActionRepository`)
- Modify: `src/presentation/controllers/TelegramWebhookController.ts:113-132` (pass the repo)
- Modify: `src/application/use-cases/SendCycleReport.ts:113-123` + spec
- Modify: `web/src/lib/actions/user.ts` (`exportMyData` includes `clarityScores`)

**Interfaces:**
- Produces:
  - `IClarityScoreRepository { record(userId: string, cycleKey: string, score: number): Promise<void> }`. The Prisma implementation upserts on `userId_cycleKey`, so the last tap wins.
  - `clarityCb(cycleKey: string, score: number): string`, producing `clr:${cycleKey}:${score}`.
  - `parseClarityCallback(data: string): { cycleKey: string; score: number } | null`, matching `/^clr:(\d{4}-\d{2}-\d{2}):([1-5])$/`.

- [ ] **Step 1: Write failing tests.**
  - Callback round-trip.
  - Rejects `clr:2026-05-01:6`, `clr:bad:3` and `chai 30`.
  - Processor: `canHandle` is true only for a valid `clr:`; `process` calls `record("u1","2026-05-01",4)`; tapping twice calls `record` twice and does not throw (Review Focus 4).
  - `SendCycleReport.spec`: after the report, `sendInteractiveMessage` gets a single row whose ids are `clr:<endedKey>:1` … `clr:<endedKey>:5`.
- [ ] **Step 2:** Run the three specs. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Schema, migration and `pnpm prisma:generate`.
  - Repo + Prisma implementation.
  - Callback module.
  - Processor: reply via `ProcessOutput.toast` = `"Thanks — noted 🙏"`, following an existing callback processor's toast usage (`grep -n "toast:" src/application/use-cases/processors`); `parsed: { intent: "UNKNOWN", confidence: 1 }`.
  - Wiring.
  - In `SendCycleReport`, after the report message, send `sendInteractiveMessage(user.telegramId, "One tap: how sure are you about where your money went last cycle? (1 = no idea · 5 = fully sure)", [[1,2,3,4,5].map(n => ({ id: clarityCb(endedKey, n), title: String(n) }))])`.
- [ ] **Step 4:** Run `pnpm test:unit`. Expected: all PASS.
- [ ] **Step 5: Manual check.** Locally, tap 4, then 2 on the same report. Expected: `SELECT score FROM "ClarityScore"` returns a single row = 2.
- [ ] **Step 6: Commit.** `feat(report): ask a one-tap clarity score after each cycle`

### Task 2.4: Non-shaming copy pass

Replace these strings exactly, and update the specs that assert on them in the same commit:

| File:line | From | To |
|---|---|---|
| `cycleReport.ts:107` | `❌ over by ${x}` | `↗ ${x} past budget` |
| `cycleReport.ts:242` | `"Net overspent"` | `"Spent beyond budget"` |
| `ReportProcessor.ts:108` | `Biggest leaks in Wants:` | `Top Wants spends:` |
| `ReportProcessor.ts:138` | `❌ over by ${x}` | `↗ ${x} past budget` |
| `HelpProcessor.ts:24` | `this month's summary + top leaks` | `this month's summary + top spends` |
| `SendBudgetNudges.ts:188` | `🔴 You've gone over ${label} by ${x} this cycle.` | `🟠 ${label} is ${x} past this cycle's budget — the rest of the cycle can still balance it.` |
| `expenseFlow.ts:93` | `⚠️ ${label}: ${x} over budget` | `🟠 ${label}: ${x} past budget` |
| `productFacts.ts:118` | `biggest spending leaks` | `top spends` |

Leave `FinancialDataTools.ts:575,600` (read by the model, not the user) and code comments unchanged. Line numbers will have shifted after Tasks 2.1–2.2; match on the string.

- [ ] **Step 1:** Run `pnpm test:unit` to confirm the baseline is green. **Step 2:** Apply the replacements.
- [ ] **Step 3:** Run `pnpm test:unit`. Update failing assertions to the new copy; find them with `grep -rn "over by\|leaks\|gone over\|over budget\|Net overspent" src --include=*.spec.ts`.
- [ ] **Step 4:** `pnpm test:unit && pnpm build`. Expected: green. **Step 5: Commit.** `refactor(copy): neutral, forward-looking budget wording`

### Task 2.5: Phase 2 docs

- [ ] **Step 1: Update `productFacts.ts`.**
  - Cycle report feature `what` gets: "flags categories well above their usual, checks how last cycle's suggestion went, and ends with one thing to change next cycle".
  - Add a feature `{ name: "Clarity check", what: "After each cycle report, one tap rates how sure you are about where your money went.", why: "So Blipko can tell whether it is actually making things clearer." }`.
  - Run `pnpm test:unit src/data/ai/productTools.spec.ts`.
- [ ] **Step 2:** Add changelog `<date>-closing-the-loop.mdx` (tags `["Feature","Improvement"]`), register it, and run `cd web && pnpm build`.
- [ ] **Step 3: Commit.** `docs: product facts and changelog for the clarity loop`

**Phase 2 prod smoke:** the next payday report shows `💡 Next cycle:` and the 1–5 buttons; the score row appears in `ClarityScore`.

---

## Phase 3 — In-the-moment check-ins

All three tasks add lines to the daily check-in body built at `SendBudgetNudges.ts:230-245` (`📊 Daily check-in — … · N days left.`). GENTLE's only window is 19:00–22:59 local (`SendBudgetNudges.ts:32`).

### Task 3.1: Pace projection

**Files:**
- Modify: `src/application/use-cases/budgetMath.ts` + `budgetMath.spec.ts`
- Modify: `src/application/use-cases/SendBudgetNudges.ts:159-171`, `:230-245` + spec

**Interfaces:**
- Produces: `projectedRunOut(spent: number, budget: number, day: number, daysInPeriod: number): number | null`. Returns the 1-based cycle day on which pace reaches the budget, `Math.ceil(budget / (spent / day))`. Returns `null` when `day < 3`, `spent <= 0`, `spent >= budget`, or the result is `> daysInPeriod`.

- [ ] **Step 1: Write failing tests.**
  - `(7000, 15000, 10, 30)` → `22`
  - `(1000, 15000, 10, 30)` → `null`
  - `(5000, 15000, 2, 30)` → `null`
  - `(0, 15000, 10, 30)` → `null`
  - `(16000, 15000, 10, 30)` → `null`
- [ ] **Step 2:** `pnpm test:unit src/application/use-cases/budgetMath.spec.ts`. Expected: FAIL. **Step 3:** Implement. Expected: PASS.
- [ ] **Step 4: Failing nudge tests.**
  - `setSpend({ NEEDS: 5000, WANTS: 10000 })`. NOW is day 15/30 and the Wants budget is 15000, giving day 23. Expect the check-in body `toContain("At this pace 🎯 Wants runs out around 23 Jun")`.
  - A low-spend case has `not.toContain("At this pace")`.
- [ ] **Step 5: Implement.**
  - In the bucket loop, keep the earliest `{ meta, runOutDay }`.
  - Date = `start` + `(runOutDay - 1)` days, formatted with `new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: tz })`.
  - Append `\nAt this pace ${meta.emoji} ${meta.label} runs out around ${date}.`
  - Run the spec. Expected: PASS.
- [ ] **Step 6: Commit.** `feat(nudges): project when a bucket runs out at the current pace`

### Task 3.2: Quiet-day prompt (small purchases, B finding 1)

**Files:** `src/application/use-cases/SendBudgetNudges.ts` + spec

- [ ] **Step 1: Write failing tests** (NOW = `Date.UTC(2026, 5, 15, 20)`, tz UTC, `execute(NOW, true)`).
  - `expenseRepository.findRecent` resolves `[]` → the body contains `Nothing logged today yet — small stuff adds up. Reply like "chai 20, auto 60".`
  - It resolves one row → no such line.
  - At NOW 12:00 UTC → no line, and `findRecent` is not called.
  - Default `findRecent` to `vi.fn().mockResolvedValue([])` in `beforeEach`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - When `zonedParts(now, tz).hour >= 19`, call `expenseRepository.findRecent(user.id, { limit: 1, from: zonedStartOfDayUtc(year, month, day, tz) })`. Use `zonedParts` and `zonedStartOfDayUtc` from `src/utils/time.ts`; `findRecent`'s `from` is inclusive.
  - On an empty result, append the line.
  - Run. Expected: PASS.
- [ ] **Step 4: Commit.** `feat(nudges): evening prompt when nothing was logged today`

### Task 3.3: Tomorrow's subscription charges (B finding 3)

**Files:**
- Modify: `src/application/use-cases/SendBudgetNudges.ts` (7th constructor param `recurringRuleRepository: IRecurringRuleRepository`), plus spec construction
- Modify: `src/presentation/controllers/TelegramWebhookController.ts:335` (pass the repo)

**Interfaces:**
- Produces, exported from `SendBudgetNudges.ts`: `chargesTomorrow(rules: Array<Pick<RecurringRule, "kind" | "dayOfMonth" | "amount" | "note">>, tomorrowDay: number): string | null`.
  - EXPENSE rules where `dayOfMonth === tomorrowDay` → `📅 Tomorrow: ${sanitizeMd(note ?? "Recurring charge")} ${formatMoney(Number(amount))}`, joined with ` · `.
  - `null` when there are none.
  - `dayOfMonth` is clamped to 1–28 at creation, so month-end gaps can't occur.

- [ ] **Step 1: Write failing tests.**
  - Rules `[{EXPENSE,16,649,"Netflix"},{INCOME,16,50000,"Salary"},{EXPENSE,20,1500,"Gym"}]` with tomorrowDay 16 → `"📅 Tomorrow: Netflix ₹649"`.
  - No match → `null`.
  - Nudge spec: `recurringRuleRepository.findByUserId` resolves the Netflix rule, NOW = June 15, and the check-in body contains `"📅 Tomorrow: Netflix ₹649"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `tomorrowDay = zonedParts(new Date(now.getTime() + 86_400_000), tz).day`.
  - Load rules via `findByUserId` (active only, `PrismaRecurringRuleRepository.ts:27`).
  - Append the line. Wire the controller.
  - Run `pnpm test:unit`. Expected: PASS.
- [ ] **Step 4: Commit.** `feat(nudges): warn the evening before a recurring charge`

### Task 3.4: Phase 3 docs

- [ ] Extend the "Reminders you control" feature with: "the evening check-in warns when a bucket will run out before payday at your pace, nudges you if nothing was logged today, and flags subscriptions charging tomorrow".
- [ ] Run the productTools spec.
- [ ] Add changelog `<date>-heads-up.mdx`, register it, and run `cd web && pnpm build`.
- [ ] Commit `docs: product facts and changelog for check-in heads-ups`.

**Phase 3 prod smoke:** a GENTLE user's 19:00 check-in shows the pace, quiet-day and tomorrow lines when they apply.

---

## Phases 4–7 — scoped; detailed plan written when started

### Phase 4: Capture without typing
- **4a, paste or forward.** The user pastes or forwards "Rs.250 debited from A/c XX1234 to VPA swiggy.in@icici on 05-11-26", and it is logged as ₹250 → "Swiggy".
  - Forwarded texts already arrive as `msg.text` (`TelegramWebhookController.ts:296-308`).
  - A deterministic `bankAlert.ts` extractor (amount, debit/credit, payee, date) runs before `rememberedExpense()`. A VPA → name map handles known payees, with unknown handles title-cased.
  - The payee goes into `note`, so `CategoryMemory` learns it for free.
  - Add `date?` to `CreateExpenseDTO` and the Prisma `create` (there is no date today).
  - Add `SMS` to the `ExpenseSource` enum.
  - Add one SMS example to **both** prompt modes in `budgetParserPrompt.ts` as the AI fallback.
- **4b, auto-forward (B: "a system that captures it without asking anything of them").**
  - A per-user ingest token: generate it on the Account page, store only its hash on User.
  - Endpoint `POST /api/ingest/sms` with `Authorization: Bearer <token>`.
  - Setup guide for an iOS Shortcuts "message received" automation and an Android SMS-forwarder app.
  - The endpoint runs **only** the `bankAlert` extractor. Anything that isn't a debit/credit alert (OTPs, personal texts) is dropped **without being stored**. A match is logged and confirmed in Telegram with the existing `txn:` undo buttons.
  - Rate-limit per token.
- **Done when:**
  - A fixture spec of ~20 real alert formats (HDFC, SBI, ICICI, Axis, Kotak, Paytm, GPay, PhonePe) passes.
  - Credits route to income.
  - A duplicate alert (same amount + payee + date) isn't double-logged.
  - An OTP text posted to the endpoint returns 204 and writes no rows.

### Phase 5: Subscription detection
- **Flow:** after a cycle closes, find payees/categories with amounts within ±10% across ≥2 consecutive cycles that aren't already a `RecurringRule`. Offer "Track Netflix ₹649 as recurring?"
- **Constraints from the code:** `rec:` only acts on an existing rule, and `act:` needs the assistant lane on.
  - Use a new prefix `sub:<categoryId>:<amount>:<day>:y|n`. On yes, call `IRecurringRuleRepository.create`.
  - Source data: `expenseRepository.findRecent(userId, { from, to })`.
  - Once a rule exists, Phase 3's tomorrow line covers it automatically.
- **Done when:** a pure detector spec passes; there is at most one suggestion per payee, ever (new `NudgeKind`); it hooks into `SendCycleReport`.

### Phase 6: Balance reconciliation
- **Flow:** `/balance 12400` or "my balance is 12,400".
  - The first time, store an anchor `{amount, at}` on User (migration).
  - Later: `expected = anchor + income since − spend since`, then report the gap and re-anchor. This needs a new `sumAllBuckets(userId, from, to)`.
  - Buttons `bal:<amount>:<anchorAt>:y|n` (not `act:`) to log the gap to a reserved "Untracked" category, using the `carryExpenseCategoryId` pattern (`carryFlow.ts:44-68`).
  - `FinancialDataTools` gets `get_unaccounted`.
- **Done when:** a spec covers the first anchor and gaps > 0, = 0 and < 0 (more money than expected means unlogged income); the cycle report shows the Untracked total.

### Phase 7: Statement upload (CSV first, PDF later)
- Dashboard upload with per-bank column presets. Reuses the Phase 4 `bankAlert` payee normaliser and `Expense.date`.
- Dedupe on date ± 1 day + amount + payee. Uncertain rows go to the needs-review inbox (`web/src/app/dashboard/_components/needs-review-inbox.tsx`).
- **Done when:** fixture CSVs from 3 banks import correctly; re-uploading the same file adds 0 rows.

### Later — needs your call (evidence: B finding 6)
- **Splits (Arjun).**
  - "Paid 1200 for dinner, split 4" logs your share of ₹300 and records ₹900 owed by friends.
  - "Rahul paid me 300" settles part of it.
  - `/owed` lists who owes what.
  - New `Receivable` model; the parser gains split syntax.
- **Freelancer mode (Rahul).**
  - A "work" tag on expenses, excluded from personal budgets.
  - An option to budget from income actually received instead of the expected-salary floor (`effectiveMonthlyIncome`, `budgetMath.ts:108`).
- **Account Aggregator.** Needs FIU registration; revisit once Phase 4's auto-capture share shows how far SMS gets us.

## Execution

Recommended: **Native** (superpowers:executing-plans). I implement one phase, then one fresh reviewer checks the whole branch before its PR. The tasks within a phase share small, explicit interfaces (only Task 2.2 builds on 2.1's types), so a reviewer per task costs more than it catches. The high-stakes tasks (1.2 delete, and 4b ingest when planned) also get manual checks. Choose **Subagent-driven** if you want an independent review after every task.

Once approved, the plan is copied to `docs/superpowers/plans/2026-11-07-financial-clarity-roadmap.md`.

## Verification (whole roadmap)

- Per task: the listed `pnpm test:unit …` / `cd web && pnpm test` commands go red, then green.
- Per phase: root `pnpm lint && pnpm build && pnpm test:unit` and `cd web && pnpm lint && pnpm build && pnpm test`, then the phase's prod smoke check after the Railway deploy.
- Monthly: read the three success-metric queries.
