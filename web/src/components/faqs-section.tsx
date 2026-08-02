import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { AuthorTooltip } from "./ui/author-tooltip";
import { founderData } from "@/lib/founder-data";



export function FaqsSection() {
	return (
		<div className="mx-auto w-full max-w-3xl space-y-7 px-4 pt-16">
			<div className="space-y-2">
				<h2 className="font-semibold text-3xl md:text-4xl">
					Frequently Asked Questions
				</h2>
				<p className="max-w-2xl text-muted-foreground">
					Got questions? Here are answers about how Blipko works for Kerala users.
					Still unsure? Reach out below.
				</p>
			</div>
			<Accordion
				className="-space-y-px w-full rounded-lg bg-card shadow dark:bg-card/50"
				collapsible
				defaultValue="item-1"
				type="single"
			>
				{faqQuestions.map((item) => (
					<AccordionItem
						className="relative border-x first:rounded-t-lg first:border-t last:rounded-b-lg last:border-b"
						key={item.id}
						value={item.id}
					>
						<AccordionTrigger className="px-4 py-4 text-[15px] leading-6 hover:no-underline">
							{item.title}
						</AccordionTrigger>
						<AccordionContent className="px-4 pb-4 text-muted-foreground">
							{item.content}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
			<p className="text-muted-foreground">
				Can&apos;t find what you&apos;re looking for? Contact{" "}
				<AuthorTooltip author={founderData} />
			</p>
		</div>
	);
}

// Every string here is published as FAQPage structured data via
// generateFAQSchema, so treat each answer as a public, checkable claim.
export const faqQuestions = [
	{
		id: "item-1",
		title: "ഇത് എന്താണ് Blipko? (What is Blipko?)",
		content:
			"Blipko is a Telegram bot that helps you stick to a budget by chatting. Type what you spent — \"lunch 220\" — and it logs it, sorts it into a 50/30/20 budget, and tells you what's left. No spreadsheets, and nothing to install: it runs inside the Telegram you already have.",
	},
	{
		id: "item-2",
		title: "Which languages does it understand? Can I send voice notes?",
		content:
			"Type or speak in English, Hindi, Hinglish, Malayalam, or Manglish — \"auto 60\", \"innathe chilavu\", or a quick voice note. Code-mixed messages are fine, which is how most people actually write. Voice notes are transcribed automatically before being logged.",
	},
	{
		id: "item-3",
		title: "How does the 50/30/20 budget work?",
		content:
			"Set your monthly income once. Blipko splits it into Needs (50%), Wants (30%), and Savings (20%) — fully adjustable, and you can set a budget per category too. Every spend you log is auto-categorized into the right bucket, so you always know where your salary is going.",
	},
	{
		id: "item-4",
		title: "My salary arrives mid-month. Does the budget reset on the 1st?",
		content:
			"No. Set your payday and the budget cycle follows it — if you're paid on the 25th, your cycle runs the 25th to the 24th. Safe daily spend is paced against that window, not the calendar month. If your payday is the 1st, it behaves like a normal month.",
	},
	{
		id: "item-5",
		title: "How do I check my budget, and will it warn me?",
		content:
			"Send /status anytime for what's left in each bucket and your safe daily spend, or /report for a summary of the cycle. Nudges when a bucket crosses 80% are opt-in — you choose the volume (off, gentle, aggressive, or relentless) and they're off by default.",
	},
	{
		id: "item-6",
		title: "Can I set up rent and other bills that repeat?",
		content:
			"Yes. Tell the bot something like \"rent 12000 every month\" and it becomes a recurring rule — Blipko posts it on the due date and tells you it did. Works for income too, so your salary lands automatically. Manage them all under Recurring in the dashboard.",
	},
	{
		id: "item-7",
		title: "Can I save towards a specific goal?",
		content:
			"That's what Boxes are for. Create a box with a target — a trip, a new laptop, an emergency fund — and move money into it from any transaction. Each box keeps a ledger, so it can always tell you where its money came from, and any move can be reversed.",
	},
	{
		id: "item-8",
		title: "Is there a web app?",
		content:
			"Yes — sign in at blipko.lol with Google for the full dashboard: budget health, transaction history with filters and CSV export, monthly trends, category breakdowns, savings boxes, and Wrapped, a look back at your year. It stays in sync with your Telegram chat. Works in any browser.",
	},
	{
		id: "item-9",
		title: "What happens to my messages? Does an AI read them?",
		content:
			"Yes — to understand \"chai 30\" your message text is sent to an AI service (OpenAI, with Google Gemini as a fallback), and voice notes go to Sarvam AI for transcription. That's the only reason it's sent, and your data is never sold. The privacy policy lists every service that receives data and what's retained.",
	},
	{
		id: "item-10",
		title: "Is it free?",
		content:
			"Yes. Blipko is free during early access, and the core budgeting features will stay free. We may add a paid plan for advanced features later. There's no payment method on file and nothing to cancel.",
	},
];
