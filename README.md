# 📒 Blipko – WhatsApp Bookkeeping Bot

### Zero-UI Accounting for Small Businesses

Blipko is a fintech-grade WhatsApp chatbot that acts as a full-stack digital accountant.
Users simply type, speak, or send photos of financial activities — the bot parses everything using AI and records clean, structured accounting entries.

---

## 🚀 Executive Summary

Blipko solves bookkeeping for Indian SMBs by turning WhatsApp into an invisible, zero-friction ledger.

✔ “Gave 200 to Raju” → Recorded
✔ “Amit se 5k aaya” → Parsed
✔ “How much does Raju owe?” → Instant balance
✔ Invoice PDFs, reminders, UPI links → Automated

No UI. No app to learn. Just chat.

---

## 🎯 Target Users

* Shop owners
* Tuition teachers
* Rent owners
* Freelancers
* Local businesses
* Anyone who hates bookkeeping apps

---

## ✨ Core Features

### **1. Natural Language Ledger**

Understands Hinglish + informal Indian English:

* “Raju ko 200 udhar diya”
* “Amit se 5k aaya kal”
* “Rent 1000 every 2 months”

LLM converts to strict schema.

---

### **2. Auto Contact & Ledger Management**

* Auto-creates customers
* Suggests contacts
* Supports tags (rent, wholesale, tuition, personal)
* Multi-ledger support:

  ```
  /switch shop
  /switch freelance
  /switch rent
  ```

---

### **3. Reporting Commands**

* `/today`
* `/week`
* `/month`
* `/cashflow this month`
* `/top defaulters`
* “July me kisne pay nahi kiya?”

Returns short summary + PDF option.

---

### **4. Reminders + UPI Links**

* Gentle → Due → Overdue → Final Notice
* UPI payable link inside message
* Auto-skip reminder when webhook marks “paid”

---

### **5. Invoice Generation**

```
Generate invoice for Raju, 2000, web design
```

Bot generates branded PDF + UPI link.

---

### **6. Multi-Modal Inputs**

* Voice note → STT → Structured entry
* Bills → OCR → Transaction entry

---

## 🏗️ Architecture (Clean Architecture + SOLID + DDD)

```
src/
├── domain/
│   ├── entities/
│   └── repositories/
│
├── application/
│   ├── use-cases/
│   └── interfaces/
│
├── data/
│   ├── prisma/
│   ├── repositories/
│   └── ai/
│
└── presentation/
    ├── controllers/
    └── routes/
```

### **Principles**

* Dependency inversion
* Strict TypeScript
* Database + AI provider agnostic

---

## 🧰 Tech Stack

| Layer     | Tech                  |
| --------- | --------------------- |
| Runtime   | Node.js (Express)     |
| Language  | TypeScript            |
| DB        | PostgreSQL            |
| ORM       | Prisma                |
| AI        | Gemini / GPT-4o-mini  |
| Messaging | WhatsApp Cloud API    |
| Queue     | BullMQ + Redis (soon) |

---

## 🛠️ Installation

### 1. Clone

```bash
git clone https://github.com/square-story/blipko.git
cd blipko
```

### 2. Install

```bash
npm install
```

### 3. Environment

```bash
cp .env.example .env
```

### 4. Migrate

```bash
npx prisma migrate dev --name init
```

### 5. Run

```bash
npm run dev
```

### 6. Expose (Webhook)

```bash
ngrok http 3000
```

Put ngrok HTTPS URL into Meta WhatsApp webhook config.

---

## 🧪 Example Usage

| Message                              | Action          |
| ------------------------------------ | --------------- |
| “Gave 500 to Rahul”                  | Debit entry     |
| “Received 1000 from Rahul”           | Credit entry    |
| “Rahul ka hisab?”                    | Balance summary |
| “Raju owes 1000 rent every 2 months” | Recurring entry |
| “Invoice Raju 2000 website”          | PDF invoice     |

---

## 🗺️ Roadmap

### Phase 1 – Core Ledger

* ✓ Text parsing
* ✓ Ledger + contacts
* ✓ Balance summaries

### Phase 2 – Multi-Modal

* Voice notes
* OCR bills

### Phase 3 – Automation

* BullMQ scheduling
* Auto reminders

### Phase 4 – Analytics

* Graphs
* PDFs
* Sheets sync

---

## 🤝 Contributing

1. Fork
2. Create branch
3. Commit
4. Push
5. PR

---

## 🧑‍💻 Author

Built with ❤️ by **[MOHAMMED SADIK](https://sadik.is-a.dev)**

