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
				Can&apos;t find what you&apos;re looking for? Contact{" "}
				<AuthorTooltip author={founderData} />
			</p>
		</div>
	);
}

const questions = [
	{
		id: "item-1",
		title: "ഇത് എന്താണ് Blipko? (What is Blipko?)",
		content:
			"Blipko is a Telegram bot that helps you track money by chatting naturally in Malayalam, Manglish, or English. Type \"Raju 500 koduthu\" and it logs the transaction instantly — no spreadsheets, no apps.",
	},
	{
		id: "item-2",
		title: "Does it understand Malayalam?",
		content:
			"Yes. Say \"Raju ko 200 koduthu\", \"innathe chilavu ethra\", or send a voice note in Malayalam — Blipko understands Manglish, Hindi, and English. No form filling required. Just chat the way you normally would.",
	},
	{
		id: "item-3",
		title: "How do recurring reminders work?",
		content:
			"Tell Blipko \"remind me rent ₹8000 on 1st every month\". It creates the reminder and sends you a Telegram notification every month at 9 AM with a one-tap Mark Paid button. No more forgotten rent days.",
	},
	{
		id: "item-4",
		title: "Can I manage family or shared expenses?",
		content:
			"Yes. Create a family group with an invite code and share it with members. Everyone logs expenses, and you can see a breakdown of who spent what using the /group command or the family section on the web dashboard.",
	},
	{
		id: "item-5",
		title: "Is there a web app?",
		content:
			"Yes — sign in at blipko.app to see your dashboard with full transaction history, monthly analytics, recurring charges, vendor management, and wallet overview. Works on any browser.",
	},
	{
		id: "item-6",
		title: "Is it free?",
		content:
			"Blipko is free during early access. The core bot features will remain free. We may introduce a paid plan for advanced business features in the future.",
	},
];
