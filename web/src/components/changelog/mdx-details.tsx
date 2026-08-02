import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/** Collapsible block for the long tail of a release — the full fix list, etc. */
export function MdxDetails({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion type="single" collapsible className="not-prose my-6 w-full">
      <AccordionItem value="details">
        <AccordionTrigger className="text-sm font-medium">
          {summary}
        </AccordionTrigger>
        <AccordionContent className="prose max-w-none text-sm">
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
