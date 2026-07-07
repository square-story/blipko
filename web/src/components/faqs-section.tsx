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

export const faqQuestions = [
	{
		id: "item-1",
		title: "ഇത് എന്താണ് Blipko? (What is Blipko?)",
		content:
			"Blipko is a Telegram bot that helps you stick to a budget by chatting. Type what you spent — \"lunch 220\" — and it logs it, sorts it into a 50/30/20 budget, and tells you what's left. No spreadsheets, no apps.",
	},
	{
		id: "item-2",
		title: "Does it understand Malayalam and voice notes?",
		content:
			"Yes. Type or speak in Malayalam, Manglish, or English — \"auto 60\", \"innathe chilavu\", or a quick voice note. Blipko understands and logs it. No forms, just chat the way you normally would.",
	},
	{
		id: "item-3",
		title: "How does the 50/30/20 budget work?",
		content:
			"Set your monthly income once. Blipko splits it into Needs (50%), Wants (30%), and Savings (20%) — fully adjustable. Every spend you log is auto-categorized into the right bucket, so you always know where your salary is going.",
	},
	{
		id: "item-4",
		title: "How do I check my budget and get warnings?",
		content:
			"Send /status anytime to see how much is left in each bucket and your safe daily spend. Blipko also nudges you automatically when a bucket crosses 80% — so you can adjust before the month runs out.",
	},
	{
		id: "item-5",
		title: "Is there a web app?",
		content:
			"Yes — sign in at blipko.app for a full dashboard: budget health, expense history with filters and CSV export, monthly trends, and category breakdowns. Edit your income and budget split right there. Works on any browser.",
	},
	{
		id: "item-6",
		title: "Is it free?",
		content:
			"Blipko is free during early access, and the core budgeting features will stay free. We may add a paid plan for advanced features in the future.",
	},
];
