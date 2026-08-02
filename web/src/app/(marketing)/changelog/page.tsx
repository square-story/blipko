import { Suspense } from "react";

import { ChangelogEntryCard } from "@/components/changelog/changelog-entry-card";
import { ChangelogFilter } from "@/components/changelog/changelog-filter";
import { getAllChangelogEntries, getChangelogTags } from "@/lib/changelog";
import {
  constructMetadata,
  generateBreadcrumbSchema,
  generateChangelogCollectionSchema,
  siteConfig,
} from "@/lib/seo";

const base = constructMetadata({
  title: "Changelog",
  description:
    "Every Blipko release — new features, improvements and fixes, newest first.",
  canonical: "/changelog",
});

export const metadata = {
  ...base,
  alternates: {
    ...base.alternates,
    types: {
      "application/rss+xml": [
        { url: `${siteConfig.url}/changelog/feed.xml`, title: "Blipko changelog" },
      ],
    },
  },
};

export default function ChangelogPage() {
  const entries = getAllChangelogEntries();
  const tags = getChangelogTags();
  const counts = Object.fromEntries(
    tags.map((tag) => [tag, entries.filter((e) => e.tags.includes(tag)).length]),
  );

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateChangelogCollectionSchema(entries)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Changelog", path: "/changelog" },
            ]),
          ),
        }}
      />

      <div className="mx-auto max-w-4xl px-4 py-20 lg:py-32">
        <header className="mb-12 md:mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">
            Changelog
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Everything we&apos;ve shipped, newest first. Blipko started as a
            Telegram bot that logged what you spent; here&apos;s how it got from
            there to here.
          </p>
          <a
            href="/changelog/feed.xml"
            className="mt-4 inline-block text-sm text-muted-foreground underline hover:text-foreground"
          >
            Subscribe via RSS
          </a>
        </header>

        {tags.length > 1 && (
          // Suspense because nuqs reads useSearchParams. It wraps only the
          // chips, so the entries below stay in the prerendered HTML.
          <Suspense fallback={<div className="mb-12 h-8" />}>
            <ChangelogFilter tags={tags} counts={counts} />
          </Suspense>
        )}

        {/* Rendered server-side; the filter hides non-matching entries via CSS. */}
        {entries.map((entry) => (
          <article
            key={entry.slug}
            data-changelog-entry
            data-tags={entry.tags.join(" ")}
          >
            <ChangelogEntryCard entry={entry} headingLevel="h2">
              <entry.Content />
            </ChangelogEntryCard>
          </article>
        ))}
      </div>
    </div>
  );
}
