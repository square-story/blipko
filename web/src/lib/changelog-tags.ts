// Kept separate from changelog.ts so the client-side filter island can import
// the tag list without pulling the MDX module graph into the client bundle.

export const CHANGELOG_TAGS = [
  "Feature",
  "Improvement",
  "Fix",
  "Performance",
] as const;

export type ChangelogTag = (typeof CHANGELOG_TAGS)[number];
