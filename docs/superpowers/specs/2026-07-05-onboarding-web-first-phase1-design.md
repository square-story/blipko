# Onboarding: web-first, Telegram-linked — Phase 1

**Date:** 2026-07-05
**Branch:** `onboarding-improvements`
**Status:** approved design → implementation plan next

## Context

Blipko has **two parallel onboarding wizards** that share one `User.hasOnboarded`
flag but no runtime state:

- **Bot** (`OnboardingProcessor.ts`): a multi-step in-chat wizard (income → pick
  category groups → reminder dosage) driven by `User.onboardingStep`/`onboardingDraft`.
- **Web** (`web/src/components/onboarding.tsx` → `submitOnboarding`): a 4-step
  modal (income+currency → groups → dosage → connect Telegram) written in one
  transaction.

Because there's no shared identity between a Telegram-only user (no email) and a
Google web user (no `telegramId`), a **Telegram-first** user who later signs in on
the web creates a **second account** and gets onboarded **twice** — duplicate
setup and confusion. The only reliable bridge is the existing
`TelegramLinkToken` → `/start <token>` → `mergeTelegramUser` path.

**Decision (agreed):** the **web dashboard is the single source of truth** for
onboarding and identity; **Telegram is a linked input channel**. A Telegram-first
user is handed off to the dashboard to sign in and connect — the bot no longer
runs its own wizard. `hasOnboarded` is set **only** by web `submitOnboarding`.

This is **Phase 1**. Phase 2 (separate spec/PR) covers the web linking UX
(QR code, auto-detect connection, shared `<ConnectTelegram>`, dashboard connect
banner).

## Goals (Phase 1)

1. Retire the bot's in-chat onboarding wizard; replace it with a **hand-off** that
   points unlinked users to the dashboard.
2. Guarantee **no duplicate rows/onboarding**: don't create a Telegram-only user
   for an unlinked message; the account/link is created only via `/start <token>`.
3. Keep existing linked and legacy bot-onboarded users working (no regression).
4. Small cleanup: remove dead `completeOnboarding()`; refresh `/start` + `/help`
   copy for the web-first flow.

**Explicitly out of scope for Phase 1:** collecting `payday` in onboarding
(stays defaulted to 1, editable in Account); editing the 50/30/20 split during
onboarding; all Phase 2 web linking UX.

## Design

### 1. Bot: hand-off instead of a wizard

`OnboardingProcessor` becomes a thin **connect hand-off** responder (rename to
`ConnectAccountProcessor` for clarity):

- `canHandle`: `!user.hasOnboarded` **or** a plain `/start`/`start` (no token).
  It no longer matches `ob:*` callbacks (those are removed).
- `process`: branch on state —
  - **onboarded + `/start`** → a short "👋 Welcome back!" (today's behavior);
  - **not onboarded** → the hand-off: a friendly greeting + a URL button and one
    line of guidance:
  > 👋 Welcome to Blipko! Finish setup on your dashboard, then connect this chat.
  > Once linked, just text me what you spend — like "chai 30".

  The hand-off text/button is a **shared helper** reused by the `execute`
  short-circuit (§2) so brand-new users and legacy stubs get the identical message.

  Inline URL button `[🔗 Open dashboard]` → `WEB_APP_URL` (new optional env,
  default `https://blipko.lol`). (URL buttons use Telegram `url`, not
  `callback_data` — a small addition to the inline-button builder, or a plain
  link in the text if we keep the builder unchanged.)
- **Deleted**: the step machine, `captureIncome` / `finalizeGroups` /
  `finishOnboarding`, the group/dosage keyboards, draft handling, and the
  `ob:grp` / `ob:done` / `ob:dose` callbacks. The bot never writes
  `monthlyIncome`, `hasOnboarded`, `onboardingStep`, `onboardingDraft`, or clones
  categories.

### 2. Bot: no row for unlinked users (`ProcessIncomingMessage.ts`)

- `ensureUserExists` returns a **nullable** user:
  - existing Telegram user → return it (unchanged);
  - `/start <token>` → link/merge onto the web account (unchanged; still returns
    `wasLinked` → "✅ Account linked!");
  - **brand-new + no token → return `{ user: null }`** (do **not** create a row).
- `execute`: when there's no user, send the hand-off message and return early —
  before history load / AI parse / any processor. No DB write, so unlinked users
  never create stray rows. `mergeTelegramUser` stays for any legacy stub rows.

Net: the only way a Telegram user row gains a `telegramId` is `/start <token>`
from a signed-in web account → **one account, one onboarding**.

### 3. Consistency & backward-compatibility

- Legacy Telegram-only users already `hasOnboarded=true` (onboarded via the old
  bot wizard) keep working — `canHandle` is false for them, so they hit the normal
  expense/income/etc. processors.
- A legacy stub with `hasOnboarded=false` gets the hand-off (directed to web).
- `onboardingStep` / `onboardingDraft` columns become unused (bot stops writing
  them; web already keeps step state in React and sets `onboardingStep: null`).
  **Leave the columns** — no migration; drop in a later cleanup if desired.

### 4. Web cleanup

- Remove the dead `completeOnboarding()` from `web/src/lib/actions/user.ts`
  (no caller; `submitOnboarding` already sets `hasOnboarded`).

### 5. Copy

- `/start` for an unlinked user = the hand-off; for a linked user = a short
  "welcome back" (unchanged).
- `/help` (`HelpProcessor`) — mention that setup lives on the dashboard and how to
  connect Telegram.

## Files

Backend:
- `src/application/use-cases/processors/OnboardingProcessor.ts` → hand-off responder (rename `ConnectAccountProcessor`).
- `src/application/use-cases/ProcessIncomingMessage.ts` — nullable `ensureUserExists`, hand-off short-circuit, drop wizard wiring.
- `src/config/env.ts` — add optional `WEB_APP_URL` (default `https://blipko.lol`).
- `src/application/use-cases/processors/HelpProcessor.ts` — copy refresh.
- (If a URL inline button is used) `IMessagingPlatform` / `TelegramMessageService` — allow a `url` button; otherwise embed the link in text.

Web:
- `web/src/lib/actions/user.ts` — delete `completeOnboarding()`.

Tests:
- Rewrite `src/application/use-cases/processors/OnboardingProcessor.spec.ts` for the hand-off (unlinked → hand-off with dashboard link; onboarded → not handled).
- Update `ProcessIncomingMessage.spec.ts`: the "captures income … category selection" bot-wizard test becomes "brand-new unlinked message → hand-off, no `user.create`"; keep the `/start <token>` link test.

## Verification

- `pnpm build` + `pnpm lint` + `pnpm test:unit` green.
- Manual (needs bot + web):
  1. Message the bot from a brand-new Telegram account → hand-off with
     `[🔗 Open dashboard]`; confirm **no** user row created.
  2. Open dashboard → sign in with Google → complete web onboarding →
     Connect Telegram → `/start <token>` → "✅ Account linked!"; then "chai 30"
     logs normally.
  3. Existing bot-only user (legacy `hasOnboarded=true`) still logs expenses with
     no hand-off.

## Phase 2 (future, separate spec)

QR code for the deep link, auto-detect connection (poll `getTelegramConnectionStatus`),
a shared `<ConnectTelegram>` component (onboarding + Account card), and a dismissible
"Connect Telegram" dashboard banner when onboarded but unlinked.
