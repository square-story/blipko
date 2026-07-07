import { FaqsSection, faqQuestions } from "@/components/faqs-section";
import { constructMetadata, generateFAQSchema } from "@/lib/seo";

export const metadata = constructMetadata({
  title: "FAQ",
  description:
    "Frequently asked questions about Blipko — the Telegram budget bot for Kerala users.",
  canonical: "/faq",
});

export default function FaqPage() {
  const faqSchema = generateFAQSchema(
    faqQuestions.map((q) => ({ question: q.title, answer: q.content })),
  );

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <FaqsSection />
    </div>
  );
}
