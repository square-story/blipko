![Blipko Banner](public/Banner.png)

# Blipko – Telegram Expense Tracker

### Zero-UI bookkeeping for households and small businesses

Blipko is a Telegram chatbot that turns casual messages into structured financial records. Type, speak, or describe a transaction in any language — the bot parses it with AI and keeps your books.

No app to install. No form to fill. Just Telegram.

---

## What it does

**Log transactions in plain language**
```
"Raju ko 500 diya"             → Paid ₹500 to Raju (logged)
"Amit se 2000 aaya"            → Received ₹2000 from Amit (logged)
"paid 300 groceries"           → Paid ₹300, category: groceries
```

**Query your records**
```
"Raju balance"                 → Raju owes ₹1500
"who hasn't paid?"             → Lists all contacts with pending balance
"how much did I spend today?"  → Today's summary
"total spend this month"       → Monthly total
```

**Multiple wallets**
```
"Shop: collected 3000 Arun"    → Logged under Shop wallet
"paid 200 auto fare"           → Logged under Personal (default)
```

**Family group accounts**
```
"create family group"          → Creates group, gives invite code
[member sends invite code]     → Joins group, transactions roll up to head
"family summary"               → Per-member spend breakdown (admin only)
```

**Recurring reminders**
```
"remind me rent 8000 on 1st every month"
→ Bot notifies 2 days before due
→ Tap "Mark as Paid" → transaction auto-logged
```

**Voice notes** — send a voice message, bot transcribes and logs the transaction.

---

## Who it's for

| User | Use case |
|---|---|
| Shop owner | Track customer credit, daily collections |
| Freelancer | Track who owes you, log client payments |
| Household head | Family expense tracking, per-member breakdown |
| Anyone | Log spend/income without opening an app |

---

## Tech stack

| Layer | Tech |
|---|---|
| Runtime | Node.js + Express |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Prisma Accelerate |
| ORM | Prisma |
| AI | Gemini 2.0 Flash (primary) + GPT-4o-mini (fallback) |
| Transcription | Sarvam AI (voice notes) |
| Messaging | Telegram Bot API |
| Scheduler | node-cron |
| Dashboard | Next.js 15 (App Router) |

---

## Architecture

Clean Architecture — domain → application → data → presentation. The backend and web dashboard are separate runtimes sharing one Prisma schema.

```
blipko/              ← Backend: Express + Prisma
  src/
    domain/          ← Interfaces and entity types (no external imports)
    application/     ← Use cases and processors
    data/            ← Prisma repos, AI parsers, Telegram service
    presentation/    ← Express routes and webhook controller
  prisma/            ← Shared schema
└── web/             ← Frontend: Next.js dashboard (Server Actions, no REST layer)
```

Message flow:
```
Telegram → TelegramWebhookController
         → ProcessIncomingMessageUseCase
             1. ensureUserExists
             2. Load conversation history (context-aware AI)
             3. Keyword processors (no AI): Start, GroupOnboarding, DuePayment, Confirmation
             4. GeminiParser.parseText → ParsedData
             5. First matching processor handles the intent
```

---

## Running locally

### Prerequisites
- pnpm
- Node.js 20+
- Telegram bot token (from @BotFather)
- Prisma Accelerate API key (or a direct PostgreSQL URL)
- Gemini API key

### 1. Clone and install

```bash
git clone https://github.com/square-story/blipko.git
cd blipko
pnpm install
```

### 2. Environment

```bash
cp .env.example .env
# Fill in: DATABASE_URL, GEMINI_API_KEY, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
```

### 3. Migrate

```bash
npx prisma migrate deploy
pnpm prisma:generate
```

### 4. Run

```bash
pnpm dev          # backend on :4000
cd web && pnpm dev  # dashboard on :3000
```

### 5. Expose to Telegram

```bash
ngrok http 4000
```

```bash
source .env && curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://YOUR_NGROK_URL/api/webhooks/telegram" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" | jq
```

---

## Web dashboard

Sign in with Google at `http://localhost:3000`. Shows:

- Overview stats (spend, income, net)
- Monthly analytics and category breakdown
- Transaction list with filters
- Wallet management
- Recurring charges and upcoming dues
- Family group — per-member spend cards and transaction drilldown

Dashboard env: copy `web/.env.example` → `web/.env.local` and fill in `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`.

---

## Supported languages

English, Hindi, Manglish, Malayalam, Hinglish. The AI prompt is tuned for informal Indian transaction descriptions.

---

## Author

Built by **[Mohammed Sadik](https://sadik.is-a.dev)**
