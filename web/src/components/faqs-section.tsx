import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

export function FaqsSection() {
	return (
		<div className="mx-auto w-full max-w-3xl space-y-7 px-4 pt-16">
			<div className="space-y-2">
				<h2 className="font-semibold text-3xl md:text-4xl">
					Frequently Asked Questions
				</h2>
				<p className="max-w-2xl text-muted-foreground">
					Here are some common questions and answers that you might encounter
					when using Blipko. If you don't find the answer you're looking for,
					feel free to reach out.
				</p>
			</div>
			<Accordion
				className="-space-y-px w-full rounded-lg bg-card shadow dark:bg-card/50"
				collapsible
				defaultValue="item-1"
				type="single"
			>
				{questions.map((item) => (
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
				Can't find what you're looking for? Contact {" "}
				<a className="text-primary hover:underline" href="https://sadik.is-a.dev">
					Founder
				</a>
			</p>
		</div>
	);
}

const questions = [
	{
		id: "item-1",
		title: "What is Blipko?",
		content:
			"Blipko is an AI-powered ledger that lives in WhatsApp. It allows you to manage finances, track debts, and send invoices just by chatting naturally, like 'Gave 200 to Raju'.",
	},
	{
		id: "item-2",
		title: "How does the AI parsing work?",
		content:
			"Blipko uses advanced LLMs to understand informal language, including Hinglish and local dialects. You can say 'Amit se 5k aaya kal' or 'Raju ko 200 udhar diya', and it will automatically categorize the transaction.",
	},
	{
		id: "item-3",
		title: "Can I send invoices and reminders?",
		content:
			"Yes! You can generate professional PDF invoices with a simple command. Blipko also handles automated reminders with UPI links, sending polite notices before, on, or after the due date.",
	},
	{
		id: "item-4",
		title: "Does it support recurring payments?",
		content:
			"Absolutely. Just tell Blipko 'Raju owes 1000 rent every 2 months', and it will set up auto-debits and reminders for you.",
	},
	{
		id: "item-5",
		title: "Can I manage multiple businesses?",
		content:
			"Yes, Blipko supports multi-book behavior. You can switch between ledgers for 'Shop', 'House rent', or 'Personal' using simple commands like '/switch shop'.",
	},
	{
		id: "item-6",
		title: "What about reports and analytics?",
		content:
			"Get instant insights with commands like '/today', '/month', or 'Top 5 overdue clients'. You can also export data to Excel or sync with Google Sheets for your accountant.",
	},
	{
		id: "item-7",
		title: "Can I use voice notes or images?",
		content:
			"Yes! Send a voice note saying 'Received 3000 from Amit' or a photo of a bill. Blipko uses speech-to-text and OCR to convert them into structured ledger entries.",
	},
];
