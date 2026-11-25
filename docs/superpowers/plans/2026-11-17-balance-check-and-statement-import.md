# Phases 6 & 7 — Balance Check + Statement Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native). TDD: red → green per step. One PR per phase. The roadmap and Phases 1–3 (shipped in PR #73) are in `docs/superpowers/plans/2026-11-07-financial-clarity-roadmap.md`. The user has dropped Phases 4 and 5 for now, so this plan doesn't depend on them.

## Context

Both research write-ups (Simile Mishra) start from the same scene: you open your bank app and the balance doesn't match what you think you spent. Blipko only knows what was logged, and B shows that small, unlogged spends are the biggest blind spot.

- **Phase 6 (balance check)** turns that gap into a number: "₹2,200 isn't accounted for". It offers to log the gap so the books close.
- **Phase 7 (statement import)** is the bulk version. Upload the bank CSV, and the rows nobody logged get added. It never double-counts what the bot already has.

**Decisions confirmed with the user:**
- The balance is **one total** (bank + UPI + cash the user spends from). There is no per-account tracking.
- In the CSV import, **credits are unticked by default**. Salary is usually already logged, and transfers or refunds would wrongly raise the budget.

**My own defaults (flag them in review if you disagree):**
- An unaccounted gap is logged as a **WANTS** expense in a category called **"Untracked"**. This follows B: small discretionary spends are the blind spot.
- If the user has **more money than expected**, Blipko tells them and re-anchors the balance. It does not offer a button, because there is no honest income category for unknown money.
- Import supports **CSV only**. XLS and PDF are out of scope; the UI hint says "Save as CSV" for banks that export XLS.

## Global constraints (unchanged)

- Money in text always goes through `formatMoney()`; names go through `sanitizeMd()`. Dates are in the user's timezone, never from `toISOString()`.
- Only the root `prisma/schema.prisma` is edited. Copy it to `web/prisma/schema.prisma` in the same commit, because CI runs `diff -q`.
- The grounding contract applies to the new assistant tool: money is pre-formatted, and absence comes with a `note`.
- No new dependencies. That includes no CSV library; the parser is about 30 lines and has tests.
- Commits carry no AI attribution. Use the gh account switch, and work through PRs rather than pushing to main (memory notes).
- Each phase ships with a `productFacts.ts` update and a changelog entry (`web/content/changelog/*.mdx`, registered in `web/src/lib/changelog.ts`).

---

## Phase 6 — Balance check (`feat/balance-check`)

### The math

`expected = anchor + incomeSince − spentSince`, where "since" means `[anchorAt, now)`. The terms are built from existing repository methods:

- **incomeSince** = `incomeRepository.sumForMonth(from, to)` − `sumCarryForMonth(from, to)`.
  - "Opening Balance" carry rows are bookkeeping, not new cash.
- **spentSince** = Σ `expenseRepository.sumByBucketForMonth` over NEEDS, WANTS and SAVINGS, minus `sumByCategoryForMonth(carriedForwardCategoryId)`.
  - The carry category is looked up with `categoryRepository.findByNameForUser(userId, CARRY_EXPENSE_CATEGORY)` and is skipped if missing.
- **plus** diverted box spends: a new `IBoxRepository.sumLinkedOutSince(userId, from, to)`, which sums `BoxEntry` rows where `direction OUT`, `source LINKED` and `isDeleted false` within the date range.
  - Without this, every box-linked spend would look like unaccounted money, because the diversion soft-deletes the Expense (`web/src/lib/box-transfer.ts`, and the bot's equivalent).
- **Not counted:** manual box IN/OUT entries. These are virtual jars, and the cash hasn't moved. Add a `ponytail:` comment to say so.

The **verdict** comes from `gap = expected − actual`:
- `|gap| < max(100, 1% of |expected|)` → **MATCH**
- `gap > 0` → **MISSING**
- otherwise → **EXTRA**

### Task 6.1: Pure balance math

**Files:** create `src/application/use-cases/balanceCheck.ts` and `balanceCheck.spec.ts`.

**Interfaces it produces:**
- `balanceVerdict(expected: number, actual: number): { gap: number; verdict: "MATCH" | "MISSING" | "EXTRA" }`
- `parseBalanceText(text: string): { amount: number | null } | null`
  - Returns `null` when the text isn't a balance message at all.
  - Returns `{ amount: null }` for a bare `/balance` with no figure.
  - Matching steps:
    1. Match `^\/?(?:my\s+)?(?:(?:bank|account)\s+)?bal(?:ance)?(?:\s+is)?\s*[:=-]?\s*(.*)$` (case-insensitive).
    2. If the remainder is empty, return `{ amount: null }`.
    3. Otherwise return the remainder parsed with `parseBareAmount` (`carryFlow.ts:21`).
    4. If that parse fails, return `null` so the text falls through to the AI parser.
- `expectedBalance(deps, user, now): Promise<{ anchor; anchorAt; income; spent; expected } | null>`
  - Returns `null` when `user.balanceAnchor` is unset.
  - This is the single place the math lives. The processor and the assistant tool both call it.

**Step 1: write failing tests.**
- `balanceVerdict`: (9200, 9150) → MATCH; (9200, 7000) → MISSING with gap 2200; (9200, 10700) → EXTRA with gap −1500; (50000, 49600) → MATCH, because of the 1% tolerance.
- `parseBalanceText` should match:
  - `/balance 12400`
  - `balance ₹12,400`
  - `my balance is 12400`
  - `bank balance: 12400`
  - `bal 500`
  - `/balance` → `{amount:null}`
- `parseBalanceText` should not match: `chai 30`, `balance sheet review`, `balanced diet 200`.
- `expectedBalance`, with mocked repositories:
  - Excludes carry income.
  - Subtracts the "Carried Forward" category.
  - Adds linked box OUT entries.
  - Returns `null` without an anchor.

**Step 2: implement, then run** `pnpm test:unit src/application/use-cases/balanceCheck.spec.ts`. Expected: PASS.

### Task 6.2: Schema, DTO date and repositories

**Files:**
- `prisma/schema.prisma`:
  - Add `balanceAnchor Decimal? @db.Decimal(12,2)` and `balanceAnchorAt DateTime?` to User.
  - Migration name: `balance_anchor`.
  - Copy the schema to `web/prisma/schema.prisma`.
- `IUserRepository.UpdateUserDTO`: add both fields.
- `IExpenseRepository.CreateExpenseDTO` and `PrismaExpenseRepository.create`: add `date?: Date`, passed straight through.
- `IBoxRepository` and `PrismaBoxRepository`: add `sumLinkedOutSince`.
- `src/data/repositories/mergeTelegramUser.ts`: when a bot-only user links, copy the bot user's anchor if the web user has none. Add a spec case for it.

**Verify:**
- `pnpm prisma:migrate` then `pnpm prisma:generate`.
- Repository spec: `sumLinkedOutSince` ignores MANUAL and IN entries.
- Merge spec: the anchor is carried over.

### Task 6.3: BalanceProcessor (text + `bal:` callback)

**Files:**
- Create `src/application/use-cases/balanceCallback.ts` with the `bal:<pendingId>:y|n` grammar, modelled on `carryCallback.ts`. A cuid id fits Telegram's 64-byte limit.
- Create `processors/BalanceProcessor.ts` and its spec.
- `src/domain/entities/PendingAction.ts`: add `BALANCE_GAP: z.object({ amount: z.number().positive().max(1e9), at: z.string() })`.
- `carryFlow.ts`:
  - Extract the body of `carryExpenseCategoryId` into `ensureNamedCategory(categoryRepository, userId, name, bucket)`.
  - `carryExpenseCategoryId` keeps its signature and calls the new function.
  - Export `UNTRACKED_CATEGORY = "Untracked"`.
- `ProcessIncomingMessage.ts`: register the processor pre-parse, right after `StatusProcessor`. Only register it when `pendingActionRepository` exists, the same rule the carry processors follow.

**How the processor behaves:**
- `canHandle`: `parseBalanceText(text) !== null`, or the text starts with `bal:`. It yields when `context.replyTarget` is set, as `UndoProcessor` does.
- **`/balance` with no figure:**
  - With an anchor: `Expected now: ₹X — ₹12,400 on 12 Nov, +₹A income, −₹B spent since. Send your real balance like "balance 9000" to check.`
  - Without one: `Send your total balance (bank + UPI + cash) like "balance 12400" — I'll check it against what you log from today.`
- **First anchor:** save `{balanceAnchor, balanceAnchorAt: now}` and reply `✅ Balance saved: ₹12,400. Next time you send it, I'll check it against everything logged since.`
- **Every later check:**
  - Compute `expectedBalance`, then **re-anchor to the new figure at `now`**.
  - The reply always starts with:
    - `🔍 Balance check since {date}`
    - `Started ₹A · income +₹B · spent −₹C`
    - `Expected ₹E · you have ₹F`
  - Then, by verdict:
    - **MATCH**: `✅ All accounted for.`
    - **MISSING**:
      - Text: `₹G isn't accounted for — usually small cash or UPI spends that never got logged.`
      - Stage a `BALANCE_GAP` PendingAction with a 24h TTL, payload `{amount: G, at: oldAnchorAt→now boundary ISO}`.
      - Buttons: `[Log ₹G as Untracked]` → `bal:<id>:y` and `[Skip]` → `bal:<id>:n`.
    - **EXTRA**: `You have ₹G more than expected — probably income or a refund that wasn't logged. Send it like "refund 1500" and it'll count.`
- **On `bal:<id>:y`:**
  - Call `pendingActionRepository.consume(id, user.id)`. This makes the button single-use, so a double tap returns the toast "Already done".
  - Create an expense with:
    - category = Untracked (`ensureNamedCategory`, WANTS)
    - bucket WANTS, confidence 1
    - `rawText: "[balance] untracked since {date}"`
    - **`date: new Date(at - 1000)`**, i.e. just before the new anchor, so the next check doesn't count the gap twice
  - Clear the keyboard with `editInteractiveMessage(..., [])`.
  - Toast: `Logged ₹G as Untracked`.
- **On `:n`:** consume the action, clear the keyboard, toast `Skipped`.
- Every reply is non-shaming: there is no "lost" or "missing money!" wording.

**Step 1: write failing tests.**
- Text and callback routing.
- First anchor.
- MATCH, MISSING (asserts the staged payload and the buttons) and EXTRA.
- Re-anchoring happens on every check.
- `y` writes an expense with a date before the anchor.
- A double tap writes only once.
- An expired or foreign id gives a toast and no write.
- `balance sheet review` is not handled.

**Step 2: implement, then run** `pnpm test:unit`. Expected: all green.

### Task 6.4: Assistant tool, report line, help, docs

- **Assistant tool `get_expected_balance`:**
  - Add the method to the `IFinancialDataTools` interface and implement it in `FinancialDataTools.ts` by calling `expectedBalance`. All money is formatted.
  - Without an anchor, return `note: "No balance saved yet — the user can send 'balance 12400'."`.
  - Add a catalog entry and a dispatch case in `assistantTools.ts`. Its description: "what the user's balance should be now, from their last stated balance plus everything logged since; it never knows the real bank balance".
  - Tests: the catalog contains it, and dispatch returns formatted strings.
- **`cycleReport.ts`:** when the ended cycle's `cats[0]` has an "Untracked" entry with total > 0, append `\n\nFound by balance checks: ₹X you hadn't logged.` Add a spec case.
- **`HelpProcessor`:** add the line `• /balance 12400 — check your real balance against what you logged`.
- **`productFacts.ts`:**
  - Add the command `/balance`.
  - Add a feature `{ name: "Balance check", what: "Send your real balance; Blipko compares it with what you logged since last time and shows what isn't accounted for, with one tap to log it.", why: "Unlogged small spends are the usual reason the bank balance surprises you." }`.
- **Changelog:** add `2026-11-??-balance-check.mdx` (tags Feature) and register it.
- **Verify:** root `pnpm lint && pnpm build && pnpm test:unit`, and `cd web && pnpm build`.

**Phase 6 prod smoke:**
1. Send `balance 10000`, log `chai 50`, then send `balance 9500`.
2. Expect expected ₹9,950 and ₹450 not accounted for.
3. Tap Log: there should be an Untracked ₹450 row.
4. Send `balance 9500` again: expect ✅ All accounted for.

---

## Phase 7 — Statement import, CSV (`feat/statement-import`)

Everything runs in `web/`. The web app cannot import `src/`, so it uses web-side ports, which is the established pattern (`web/src/lib/category-memory.ts`, `budget.ts`).

The file is parsed **in the browser**, so the raw statement never reaches the server. Only normalised rows are sent to server actions, capped at 1000 rows (the default 1MB action body limit is plenty).

### Task 7.1: Pure parsing (`web/src/lib/import/`)

**Files:** `csv.ts`, `statement.ts`, `statement.spec.ts`, and fixtures in `__fixtures__/{hdfc,sbi,icici,axis}.csv`. The fixtures are realistic but synthetic; each has a preamble of account-info rows, a header row and about 8 transactions.

**Interfaces it produces:**
- **`parseCsv(text): string[][]`**
  - Handles quotes, escaped `""`, CRLF and a BOM.
  - Picks the delimiter from the first 5 lines: whichever of `,` and `\t` appears more.
- **`detectColumns(rows): Mapping | null`**
  - Finds the header row: the first row with a date-like header *and* an amount-like header.
  - Maps the date column by `/(txn|tran|transaction|value)?\s*date/`. It prefers the transaction date over the value date.
  - Maps the description column by `/narration|description|particulars|remarks|details/`.
  - Maps either split debit/credit columns (`/withdrawal|debit|^dr$/`, `/deposit|credit|^cr$/`) **or** a single `amount` column plus a `dr/cr` type column.
  - Returns `null` when nothing is found, and the UI then asks the user to map columns.
- **`toTransactions(rows, mapping, tz)`** returns `{ txns: StatementTxn[]; skipped: number }`.
  - Each txn is `{ date: "YYYY-MM-DD"; amount: number; kind: "DEBIT"|"CREDIT"; narration: string; payee: string; cash: boolean }`.
  - Rows with no parsable date or amount (balance lines, totals) are counted in `skipped`.
- **`parseStatementDate(s)`** accepts `dd/mm/yyyy`, `dd-mm-yy`, `dd-MMM-yyyy`, `dd MMM yyyy` and `yyyy-mm-dd`, using date-fns `parse` (already installed). It is **day-first**, because these are Indian banks.
- **`parseAmount(s)`** handles `"1,234.50"`, `"1,234.50 Dr"` and an empty string (→ null).
- **`payeeFromNarration(s)`:**
  - Splits on `/` and `-`.
  - Drops tokens that are: `UPI/DR/CR/P2M/P2A/POS/NEFT/IMPS/RTGS/TO TRANSFER`, all digits, masked card numbers, IFSC codes (`^[A-Z]{4}0`), and tokens containing BANK or LTD.
  - Drops generic words (`/^(payment|paid|pay to|sent|upi)/i`).
  - Takes the first remaining token with at least 3 letters and title-cases it.
  - If only a VPA remains, uses its local part with digits stripped (`swiggy8@ybl` → "Swiggy").
  - Truncates to 100 characters, the note limit.
- **`cash`** is true when the narration matches `/\b(ATM|ATW|NWD|CASH WDL)\b/i`.

**Step 1: write failing tests.**
- Each fixture parses to the expected count, dates, amounts, kinds and payees. Each fixture is pinned with `toEqual`.
- A quoted narration containing a comma.
- A preamble is skipped.
- A `Dr/Cr` single-column layout.
- An unknown layout gives `null`.
- `31/12/26` is read as 31 December, not as an invalid month.

**Step 2: implement, then run** `cd web && pnpm test`. Expected: PASS.

### Task 7.2: Duplicate matching (pure)

**Files:** add `markDuplicates` to `statement.ts`, with spec cases.

**Interface:** `markDuplicates(txns, existing: { date: string; amount: number; kind }[]): boolean[]`. The matching is **one-to-one**: each existing row can absorb only one statement row. Two rows match when they have the same kind, the same amount to the paisa, and dates no more than 1 day apart.

Payee is deliberately not compared. The bot logs "lunch 250" while the bank says "Swiggy", and missing that match would double-count.

**Tests:**
- 2 bank rows of ₹20 against 1 logged row → `[true, false]`.
- A match across ±1 day.
- A different kind doesn't match.
- Re-importing the same file → all `true`.

### Task 7.3: Schema + server actions

**Files:**
- `prisma/schema.prisma`: add `IMPORT` to `ExpenseSource`. Migration name: `expense_source_import`. Copy the schema to the web copy.
- `web/src/lib/category-memory.ts`: add `findRememberedCategories(userId, keys: string[]): Promise<Map<string, string>>`, one `findMany` with `phraseKey in keys` that excludes group categories.
- Create `web/src/lib/actions/import.ts`. Every action starts with the standard `auth()` guard and checks input with zod (`StatementTxn` schema, `.max(1000)`).

**`previewImport(txns)`:**
1. Load the user's timezone.
2. Load the user's non-deleted expenses and incomes in `[minDate − 1d, maxDate + 2d)`. Each one's date becomes a key via `zonedYmd` (`web/src/lib/time.ts:89`).
3. Run `markDuplicates`.
4. Look up remembered categories keyed by `phraseMemoryKey(payee)`.
5. Return for each row: `{ duplicate, categoryId | null, defaultInclude }`.
   - `defaultInclude` = `kind === "DEBIT" && !duplicate && !cash`.
   - Credits and cash withdrawals are unticked, per the user's decision. A cash withdrawal moves money into cash, so logging it would double-count the cash spends.

**`commitImport(rows: { txn; categoryId?; incomeCategoryId? }[])`:**
- Create one `batchId = nanoid()`.
- Store the date as **noon in the user's timezone** for the row's date, using `zonedStartOfDayUtc` + 12h, so no timezone shift can move it to another day.
- **Debit rows** become `prisma.expense.createManyAndReturn` (Prisma 5.22 supports it on Postgres) with:
  - `source: "IMPORT"`
  - `rawText: "[import] " + narration` (sliced to 500)
  - `note: payee`
  - bucket = the category's bucket, or WANTS when there's no category
  - `confidence: categoryId ? 1 : 0.5`, so uncategorised rows land in the existing needs-review inbox (`expenses.ts:220`)
- **Credit rows** become `prisma.income.createMany` with `batchId` and `incomeCategoryId`; the default is `INCOME_FALLBACK_CATEGORY`, which is "Other Income".
- Afterwards:
  - Call `divertExpenseToLinkedBox` for rows whose category is linked to a box.
  - Call `rememberCategoryChoice(userId, payee, categoryId)` for rows where the user picked the category.
  - Revalidate the dashboard paths, the same set `expenses.ts` and `revalidateIncome()` use.
- Return `{ success, batchId, expenses: n, income: m }`.

**`undoImport(batchId)`:**
- Soft-delete the expenses and income for this user and `batchId`.
- Soft-delete box entries whose `sourceExpenseId` is in that batch's expense ids.
- Run it all as one `$transaction`.

**Verify on the local DB** (via a small script, or manually through the page):
- Import the HDFC fixture → N rows.
- Re-import it → 0 new rows, because everything is flagged as a duplicate.
- `undoImport` → the rows are soft-deleted.

### Task 7.4: Import page

**Files:**
- `web/src/app/dashboard/import/page.tsx` (a server component: auth, categories, income categories).
- `web/src/app/dashboard/import/_components/import-wizard.tsx` (client).
- `web/src/lib/menu-list.ts`: add `{ href: "/dashboard/import", label: "Import", icon: Upload }` to the Budget group.

**The wizard, built from existing shadcn/ui parts only** (`card`, `table`, `checkbox`, `select`, `badge`, `button`, `CategoryCombobox`):

1. **Pick a file.**
   - `<input type="file" accept=".csv,text/csv">` with the hint "Download your statement as CSV from net banking (Excel files: open and Save As CSV)."
   - The file is parsed in the browser.
   - If `detectColumns` returns null, show 3 or 4 `Select` dropdowns to map Date, Description and Debit/Credit or Amount.
2. **Preview** (after `previewImport`).
   - A table with a header that reads `N new · D already logged · C credits & cash (unticked)`.
   - Columns: include checkbox · date · payee · amount (credits shown in green) · category · badge.
   - Badges: "Already logged?", "Credit", "Cash withdrawal".
   - The category cell is a `CategoryCombobox` for debits and an income-category `Select` for credits.
   - Changing a payee's category **applies to every row with the same payee**, so 12 Swiggy rows take one pick.
3. **Import.** Call `commitImport`, then show the toast `Imported 42 expenses` with an **Undo** action that calls `undoImport`. Then link to `/dashboard/expenses`.

**Verify:** `cd web && pnpm lint && pnpm build`. Then check manually with `pnpm dev`:
- Upload each fixture.
- Re-upload one: everything should be unticked.
- Undo works.
- Uncategorised rows show up in the dashboard's needs-review inbox.

### Task 7.5: Docs

- **`productFacts.ts`:**
  - Add a feature `{ name: "Statement import", what: "Upload your bank statement as a CSV on the dashboard's Import page; Blipko adds the spends you didn't log, skips ones it already has, and lets you undo the whole import.", why: "Catches the purchases that never made it into chat." }`.
  - Add "statement import" to `dashboard.whatItIsFor`.
  - Run `pnpm test:unit src/data/ai/productTools.spec.ts`.
- **`dataHandling`:** add "Statement files are read in your browser; only the transactions you import are saved."
- **Changelog:** add `…-statement-import.mdx` (Feature) and register it. Run `cd web && pnpm build`.

**Phase 7 prod smoke:**
1. Import your own real bank CSV.
2. Check the payee names. Fix fixture rules for any bank whose narration format parses badly, using a new fixture + test.
3. Re-import the file: 0 rows added.

---

## Review focus

1. **The balance gap row being counted twice.** The gap expense must be dated before the new anchor (Task 6.3 test).
2. **Double tap on "Log as Untracked".** `consume()` makes it single-use (Task 6.3 test).
3. **Box-linked spends showing up as "unaccounted".** `sumLinkedOutSince` covers this (Task 6.1 test).
4. **An import double-counting bot-logged spends.** One-to-one amount + date matching, and re-import adds 0 (Task 7.2).
5. **Import dates shifting a day.** Dates are stored at noon in the user's timezone, and day-first parsing is pinned by `31/12/26` (Tasks 7.1, 7.3).
6. **The import trust boundary.** Zod validation, a 1000-row cap and the ownership guard on `undoImport` (Task 7.3).

## Skipped (add when asked)

- Per-account balances.
- Setting the balance anchor from a statement's closing balance.
- XLS and PDF statements.
- A shared payee normaliser in the bot. This only matters if SMS capture (Phase 4) is revived.
- A web UI for the balance check.

## Verification (per phase, before the PR)

- Root: `pnpm lint && pnpm build && pnpm test:unit`.
- Web: `cd web && pnpm lint && pnpm build && pnpm test`.
- `diff -q prisma/schema.prisma web/prisma/schema.prisma`.
- `pnpm exec playwright test`.
- Then the phase's prod smoke check after the Railway deploy.
