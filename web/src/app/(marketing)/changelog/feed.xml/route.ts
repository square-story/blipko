import { getAllChangelogEntries } from "@/lib/changelog";
import { siteConfig } from "@/lib/seo";

// Prerendered at build; nothing here is read at request time.
export const dynamic = "force-static";

const ENTITIES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  '"': "&quot;",
};

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => ENTITIES[char]!);
}

/** YYYY-MM-DD is UTC midnight, not local — keeps pubDate off by-one-day free. */
function toRfc822(date: string): string {
  return new Date(`${date}T00:00:00Z`).toUTCString();
}

export function GET() {
  const entries = getAllChangelogEntries();

  const items = entries.map((entry) => {
    const url = `${siteConfig.url}/changelog/${entry.slug}`;
    const categories = entry.tags
      .map((tag) => `      <category>${escapeXml(tag)}</category>`)
      .join("\n");

    return `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${toRfc822(entry.date)}</pubDate>
      <description>${escapeXml(entry.summary)}</description>
${categories}
    </item>`;
  });

  // From the newest entry, not Date.now(): the feed bytes shouldn't churn on
  // every rebuild.
  const lastBuildDate = entries[0]
    ? toRfc822(entries[0].date)
    : new Date(0).toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.name)} changelog</title>
    <link>${siteConfig.url}/changelog</link>
    <description>Every ${escapeXml(siteConfig.name)} release — new features, improvements and fixes.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${siteConfig.url}/changelog/feed.xml" rel="self" type="application/rss+xml"/>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
