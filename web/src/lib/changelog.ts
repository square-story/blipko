import type { MDXProps } from "mdx/types";
import { z } from "zod";

import { CHANGELOG_TAGS, type ChangelogTag } from "./changelog-tags";

// ── Registry ───────────────────────────────────────────────────────────────
// Shipping a release = add the .mdx file, then add an import here and drop it
// into `modules`. Order doesn't matter; entries sort by meta.date descending.
//
// Static imports rather than fs.readdir on purpose: the content stays in
// Turbopack's module graph, so editing an .mdx hot-reloads, and there is no
// runtime filesystem access to trace on deploy. See content/changelog/README.md.
import * as telegram from "../../content/changelog/2026-05-08-telegram.mdx";
import * as budgetTracker from "../../content/changelog/2026-06-11-budget-tracker.mdx";
import * as recurringPayday from "../../content/changelog/2026-06-12-recurring-payday.mdx";
import * as categories from "../../content/changelog/2026-06-29-categories.mdx";
import * as editAnywhere from "../../content/changelog/2026-07-07-edit-anywhere.mdx";
import * as boxesWrapped from "../../content/changelog/2026-07-30-boxes-wrapped.mdx";

const modules = [
  telegram,
  budgetTracker,
  recurringPayday,
  categories,
  editAnywhere,
  boxesWrapped,
];

// ── The `meta` contract ────────────────────────────────────────────────────
const changelogMetaSchema = z.object({
  // The permalink. Permanent — changing it breaks existing links.
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  title: z.string().min(1).max(80),
  // Ship date. Held as a string so it round-trips verbatim into <time dateTime>
  // and RSS; only converted to a Date at the edges, always as UTC.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  // One sentence. Feeds RSS, the meta description and the in-app panel.
  summary: z.string().min(1).max(200),
  tags: z.array(z.enum(CHANGELOG_TAGS)).min(1),
  // Optional Cloudinary public ID for the social card.
  cover: z.string().min(1).optional(),
});

export type ChangelogMeta = z.infer<typeof changelogMetaSchema>;

export type ChangelogEntry = ChangelogMeta & {
  Content: (props: MDXProps) => React.JSX.Element;
};

// Parsed once at module load: a malformed entry fails `pnpm build` rather than
// rendering something broken. No codegen step involved.
const entries: ChangelogEntry[] = modules
  .map((mod) => {
    const result = changelogMetaSchema.safeParse(mod.meta);
    if (!result.success) {
      const hint =
        typeof (mod.meta as { slug?: unknown } | undefined)?.slug === "string"
          ? (mod.meta as { slug: string }).slug
          : "<unknown entry>";
      throw new Error(
        `Invalid changelog meta for "${hint}":\n${z.prettifyError(result.error)}`,
      );
    }
    return { ...result.data, Content: mod.default };
  })
  // date is YYYY-MM-DD, so a string compare is already chronological.
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const duplicate = entries.find(
  (entry, i) => entries.findIndex((o) => o.slug === entry.slug) !== i,
);
if (duplicate) {
  throw new Error(`Duplicate changelog slug: "${duplicate.slug}"`);
}

// ── Public API ─────────────────────────────────────────────────────────────

/** All entries, newest first. */
export function getAllChangelogEntries(): ChangelogEntry[] {
  return entries;
}

export function getChangelogEntry(slug: string): ChangelogEntry | undefined {
  return entries.find((entry) => entry.slug === slug);
}

/** Tags that at least one entry actually uses, in declaration order. */
export function getChangelogTags(): readonly ChangelogTag[] {
  return CHANGELOG_TAGS.filter((tag) =>
    entries.some((entry) => entry.tags.includes(tag)),
  );
}

export function getLatestChangelogEntry(): ChangelogEntry | undefined {
  return entries[0];
}
