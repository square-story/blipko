import type { MetadataRoute } from "next";
import { getAllChangelogEntries } from "@/lib/changelog";
import { siteConfig } from "@/lib/seo";

/** YYYY-MM-DD as UTC midnight, so lastmod doesn't drift a day in -offset zones. */
function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries = getAllChangelogEntries();

  return [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/changelog`,
      lastModified: entries[0] ? utcDate(entries[0].date) : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteConfig.url}/faq`,
      lastModified: new Date("2026-05-16"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // A shipped release note doesn't change, hence "yearly".
    ...entries.map((entry) => ({
      url: `${siteConfig.url}/changelog/${entry.slug}`,
      lastModified: utcDate(entry.date),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
    {
      url: `${siteConfig.url}/privacy-policy`,
      lastModified: new Date("2026-05-16"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteConfig.url}/terms`,
      lastModified: new Date("2026-05-16"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
