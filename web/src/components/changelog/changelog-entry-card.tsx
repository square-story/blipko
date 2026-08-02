import { Badge } from "@/components/ui/badge";
import type { ChangelogEntry } from "@/lib/changelog";
import { formatDate } from "@/lib/format";

type ChangelogEntryCardProps = {
  entry: ChangelogEntry;
  /** h1 on a permalink, h2 in the index timeline. */
  headingLevel?: "h1" | "h2";
  children: React.ReactNode;
};

export function ChangelogEntryCard({
  entry,
  headingLevel = "h2",
  children,
}: ChangelogEntryCardProps) {
  const Heading = headingLevel;

  return (
    <div className="flex flex-col md:flex-row">
      {/* Date rail. top-24 clears the fixed marketing header. */}
      <div className="md:w-48 md:shrink-0">
        <div className="pb-6 md:sticky md:top-24 md:pb-10">
          {/* timeZone: UTC — a bare YYYY-MM-DD parses as UTC midnight, which
              renders as the previous day for anyone behind UTC. */}
          <time
            dateTime={entry.date}
            className="block text-sm font-medium text-muted-foreground"
          >
            {formatDate(entry.date, { timeZone: "UTC" })}
          </time>
        </div>
      </div>

      <div className="relative flex-1 pb-12 md:pl-8">
        {/* Timeline hairline + dot */}
        <div className="absolute left-0 top-2 hidden h-full w-px bg-border md:block">
          <div className="absolute size-3 -translate-x-1/2 rounded-full bg-primary" />
        </div>

        <div className="space-y-6">
          <div className="relative z-10 flex flex-col gap-3">
            <Heading className="text-2xl font-semibold tracking-tight text-balance">
              {entry.title}
            </Heading>
            <div className="flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="bg-muted">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div className="prose max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:no-underline hover:prose-a:underline">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
