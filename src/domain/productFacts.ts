// What Blipko is, told to users through the assistant.
//
// This is the product's equivalent of the grounding contract on the money
// tools: the assistant answers "what can you do?" from THIS file, never from
// what the model happens to remember about budgeting apps. A feature described
// here that does not exist is a hallucination with a longer half-life than a
// wrong number — the user acts on it and finds nothing.
//
// KEEP IN SYNC WITH THE CODE, not with README.md. The README currently
// describes an in-chat onboarding wizard that ConnectAccountProcessor replaced
// with a dashboard hand-off, which is exactly the kind of drift this file
// exists to keep out of the model's mouth.
//
// The dashboard URL is passed in rather than written here so it can never
// disagree with env.WEB_APP_URL.

export interface ProductFeature {
  name: string;
  what: string;
  // Why a user cares. The assistant is asked "how does this help me?" more
  // often than "what does this do?".
  why: string;
}

export interface ProductCommand {
  command: string;
  what: string;
}

export interface ProductFacts {
  whatItIs: string;
  howLoggingWorks: string;
  features: ProductFeature[];
  commands: ProductCommand[];
  dashboard: { url: string; whatItIsFor: string; howToConnect: string };
  dataHandling: string[];
  creator: { name: string; site: string; license: string };
}

export function buildProductFacts(dashboardUrl: string): ProductFacts {
  return {
    whatItIs:
      "Blipko is a personal budget tracker you use by chatting. You text what you spend in plain language and it sorts it into a 50/30/20 budget, tracks what's left, and answers questions about your money. There is no app to install and no forms to fill in.",

    howLoggingWorks:
      'Send what you spent the way you would say it — "chai 30", "auto 80 office", "petrol 500 koduthu". It reads English, Hindi, Hinglish, Malayalam and Manglish, including code-mixed. Voice notes work too: they are transcribed and logged the same way. If the category or bucket is unclear it asks before saving rather than guessing.',

    features: [
      {
        name: "Conversational logging",
        what: "Log a spend by texting or sending a voice note, in everyday mixed-language phrasing.",
        why: "The reason most budgeting apps fail is friction — opening an app and tapping through forms. Texting takes a second, so the habit actually survives past week two.",
      },
      {
        name: "50/30/20 budgeting on a payday cycle",
        what: "Every spend lands in Needs (50%), Wants (30%) or Savings (20%). The split is adjustable, and the cycle runs from your payday rather than the 1st.",
        why: "You see what is left in the pot that matters instead of one meaningless total, and the cycle lines up with when you actually get paid.",
      },
      {
        name: "Safe daily spend",
        what: "Shows what you can spend per day for the rest of the cycle without going over.",
        why: "Turns an abstract remaining balance into a decision you can act on today.",
      },
      {
        name: "Categories with monthly limits",
        what: "Spending groups break down into categories (Rent, Groceries, Eating Out, Fuel…), each able to carry its own monthly limit.",
        why: "Shows which specific habit is draining the month, not just that the month was expensive.",
      },
      {
        name: "Boxes — named savings goals",
        what: "Set money aside in named funds (a trip, an emergency fund) and track progress toward a target.",
        why: "Savings stop being a leftover and become a thing with a name and a finish line.",
      },
      {
        name: "Recurring income and expenses",
        what: 'Set up repeating items once — "rent 8000 on 1st every month" — and they post themselves each cycle.',
        why: "Rent, salary, EMIs and subscriptions are the predictable bulk of a month; logging them by hand is the boring part.",
      },
      {
        name: "Ask anything about your money",
        what: "Free-form questions answered from your real data: how much on food, biggest expense, can you afford something, are you spending more than last cycle.",
        why: "Answers come from your actual records, so you get a number you can trust rather than a guess.",
      },
      {
        name: "Reminders you control",
        what: "Optional nudges as a bucket fills up. Four intensities set how many times a day the bot speaks: off, gentle (once, in the evening), aggressive (twice), relentless (three times, and it keeps repeating while a bucket is over 80%).",
        why: "A warning before you overspend is worth more than a report afterwards — but only if you chose how loud it is. Off is the default.",
      },
      {
        name: "Web dashboard",
        what: "Charts, trends, a filterable and exportable transaction list, and all settings.",
        why: "Chat is best for capture and quick answers; the dashboard is where you review a month properly and change how things are set up.",
      },
    ],

    commands: [
      {
        command: "/status",
        what: "Budget health this cycle and safe daily spend.",
      },
      {
        command: "/report",
        what: "This cycle's summary and biggest spending leaks.",
      },
      { command: "/recurring", what: "See repeating income and expenses." },
      {
        command: "/boxes",
        what: "See savings boxes and progress toward targets.",
      },
      { command: "/settings", what: "Change reminder intensity and income." },
      { command: "/help", what: "Full guide to what the bot can do." },
      { command: "undo", what: "Remove the last entry." },
      { command: "/start", what: "Link this chat to a Blipko account." },
    ],

    dashboard: {
      url: dashboardUrl,
      whatItIsFor:
        "Charts and trends, the full transaction list with CSV export, editing categories and their monthly limits, managing recurring rules, and all settings including income and reminder intensity.",
      howToConnect:
        "Sign in on the dashboard, then tap Connect Telegram there to link this chat. Setting up income and categories happens on the dashboard, not in chat.",
    },

    dataHandling: [
      "Your messages are read by an AI model so it can work out the amount and category — that means the text you send is processed by an AI provider.",
      "Your spending records live in your own Blipko account and are only ever used to answer your questions.",
      "Every number reported is calculated by the app from your records, not made up by the AI. The AI chooses which figures to look up; the maths is done in code.",
      "Reminders are off by default and you choose how insistent they are.",
    ],

    creator: {
      name: "Mohammed Sadik",
      site: "https://sadik.is-a.dev",
      license: "Open source under the MIT licence.",
    },
  };
}
