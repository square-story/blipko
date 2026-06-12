# Blipko Roadmap

How to make the conversational budget tracker genuinely useful in the real world, and how to make
shipping it reliable. Each item is tagged **impact** (value to users / the team) and **effort**.
Ordered roughly by priority within each track.

> Status today: capture loop (text + voice), 50/30/20 auto-categorization, low-confidence confirm,
> `/status`, undo, `/report`, proactive nudges, web dashboard, web↔Telegram account linking, and now
> **income-over-time** (budget tracks actual income, floored at the expected salary). Backend 50 unit tests
> green; web builds.

---

## Track A — Real-world usefulness (product)

### P0 — capture must be trustworthy (the whole moat)
- **Parser accuracy loop.** We already log every parse to `ParseLog` (raw + parsed + confidence). Build a
  small review of low-confidence / corrected parses and feed fixes back into the prompt. *Impact: high ·
  Effort: med.* This is what keeps "chai 30" working across Manglish/Hinglish/Malayalam.
- **Edit / correct flows.** Reply-to-correct an amount/category/bucket (not just undo). *Impact: high · Effort: med.*
- **Voice reliability.** Voice already routes through the same pipeline; tag `source=VOICE`, and surface
  transcription confidence so a bad transcript asks to confirm. *Impact: med · Effort: low.*

### P1 — make the budget match real life
- ✅ **Recurring income & expenses + payday-aware budgeting (shipped).** Recurring rules auto-post + notify
  each month (bot RECURRING intent + web `/dashboard/recurring`); the budget window now follows the user's
  `payday` (payday→payday cycle; payday=1 = calendar month). Variable-amount bills (reminder-to-confirm) are
  the remaining fast-follow.
- **Savings goals.** "Save ₹2L for a trip by Dec" → progress against the SAVINGS bucket. *Impact: high · Effort: med.*
- **Multi-currency / locale.** `User.currency`/`locale` exist; honor them everywhere (some copy still hardcodes ₹). *Impact: med · Effort: low.*
- **Income undo + web Income page.** Extend undo to the most recent of expense/income; list income in the
  dashboard. *Impact: med · Effort: low.*

### P2 — proactive value & retention
- **Weekly digest** in addition to nudges + monthly `/report`. *Impact: med · Effort: low.*
- **Smarter nudges**: pace-based ("at this rate you'll overspend Wants by ₹3k"), not just 80%/over. *Impact: med · Effort: med.*

### P3 — reach & trust
- **WhatsApp channel** (the brief's market channel) via the existing `IMessagingPlatform` abstraction — no
  core rewrite, just an adapter + Meta verification. *Impact: high · Effort: high.*
- **Data export (CSV)** from the dashboard, and a clear privacy/data-deletion path. *Impact: med · Effort: low.*
- **Referral / share** ("track money with me"). *Impact: med · Effort: med.*

---

## Track B — Engineering workflow (ship reliably)

### P0 — get CI green and keep it green
- **Fix the `test` workflow.** It's been red since the pivot and burns the full 60-min timeout: the Playwright
  job's env still sets `META_*`/`WHATSAPP_*` but not `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET`, so the
  launched backend crashes on `env.ts` validation; `tests/api.spec.ts` still probes the removed
  `/api/webhooks/whatsapp` and `web-telegram-ui.spec.ts` uses old-schema fields. Swap the env, rewrite/remove
  those specs, add a real webhook E2E. *Impact: high · Effort: med.*
- **Lint web in CI.** Root `eslint` now (correctly) ignores `web/`; add a `cd web && pnpm lint` step so web
  regressions are caught. *Impact: med · Effort: low.*
- **Enforce branch protection** (required checks) once green, so red never lands on `main`.

### P1 — safer releases
- **Staging environment + preview deploys** per PR (Railway/Vercel), so changes are exercised before `main`.
  *Impact: high · Effort: med.*
- **Migration discipline.** Single root Prisma schema is the source of truth; the web copy auto-syncs via
  `scripts/sync-prisma-schema.mjs`. Add a CI check that `web/prisma/schema.prisma` matches root. *Impact: med · Effort: low.*
- **Feature flags** for risky bot behaviors (new intents, prompt changes). *Impact: med · Effort: med.*

### P2 — observability & quality
- **Error tracking** (Sentry) for the webhook + Server Actions; alert on parser/provider failures. *Impact: high · Effort: low.*
- **More unit coverage** around budget math and processors (already strong); add an integration test that
  runs a message end-to-end against a test DB. *Impact: med · Effort: med.*
- **ParseLog dashboard** (internal) to watch real parse quality and prompt-tune. *Impact: med · Effort: med.*

---

## Suggested next 3
1. **Fix CI `test`** (Track B P0) — stop the red/timeout, restore a real safety net.
2. **Recurring + payday-aware budgeting** (Track A P1) — biggest real-world fit after income tracking.
3. **Error tracking** (Track B P2) — cheap insurance for a money app where silent failures erode trust.
