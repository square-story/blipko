import Link from "next/link";
import { notFound } from "next/navigation";

import { ChangelogEntryCard } from "@/components/changelog/changelog-entry-card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getAllChangelogEntries, getChangelogEntry } from "@/lib/changelog";
import {
  constructMetadata,
  generateArticleSchema,
  generateBreadcrumbSchema,
} from "@/lib/seo";

// Unknown slugs 404 instead of being rendered on demand, which keeps every
// route in this segment statically prerendered.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllChangelogEntries().map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getChangelogEntry(slug);
  if (!entry) return {};

  return constructMetadata({
    title: entry.title,
    description: entry.summary,
    canonical: `/changelog/${entry.slug}`,
    ogType: "article",
    publishedTime: entry.date,
    // null so the per-entry opengraph-image.tsx wins over the site default.
    image: null,
  });
}

export default async function ChangelogEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getChangelogEntry(slug);
  if (!entry) notFound();

  const entries = getAllChangelogEntries();
  const index = entries.findIndex((e) => e.slug === entry.slug);
  const newer = index > 0 ? entries[index - 1] : undefined;
  const older = index < entries.length - 1 ? entries[index + 1] : undefined;

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateArticleSchema({
              title: entry.title,
              description: entry.summary,
              slug: entry.slug,
              datePublished: entry.date,
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Changelog", path: "/changelog" },
              { name: entry.title, path: `/changelog/${entry.slug}` },
            ]),
          ),
        }}
      />

      <div className="mx-auto max-w-4xl px-4 py-20 lg:py-32">
        <Breadcrumb className="mb-10">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/changelog">Changelog</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{entry.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <ChangelogEntryCard entry={entry} headingLevel="h1">
          <entry.Content />
        </ChangelogEntryCard>

        {(newer || older) && (
          <nav className="mt-8 flex flex-wrap justify-between gap-4 border-t pt-8 text-sm">
            {older ? (
              <Link
                href={`/changelog/${older.slug}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                ← {older.title}
              </Link>
            ) : (
              <span />
            )}
            {newer ? (
              <Link
                href={`/changelog/${newer.slug}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {newer.title} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
