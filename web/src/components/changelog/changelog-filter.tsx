"use client";

import { parseAsString, useQueryState } from "nuqs";

import { Button } from "@/components/ui/button";

/**
 * Only the chip row is a client component. The entries themselves are rendered
 * by the server page and stay in the static HTML — this just hides the ones
 * that don't match, via a scoped style rule.
 *
 * Doing it the other way round (passing entries into the island and filtering
 * the array) would put every MDX body behind the Suspense boundary that
 * useSearchParams requires, so none of the release notes would be in the
 * prerendered HTML.
 */
export function ChangelogFilter({
  tags,
  counts,
}: {
  tags: readonly string[];
  counts: Record<string, number>;
}) {
  // shallow: true (the default) unlike every other useQueryState here — those
  // tables refetch server-side, whereas this must not, so /changelog stays
  // statically prerendered.
  const [tag, setTag] = useQueryState("tag", parseAsString);

  const active = tag && tags.includes(tag) ? tag : null;

  return (
    <>
      {active && (
        // `active` is validated against the closed tag set above, so it is safe
        // to interpolate into a selector.
        <style>{`[data-changelog-entry]:not([data-tags~="${active}"]){display:none}`}</style>
      )}

      <div className="mb-12 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={active ? "outline" : "default"}
          className="rounded-full"
          onClick={() => setTag(null)}
        >
          All
        </Button>
        {tags.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={active === t ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setTag(active === t ? null : t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {active && counts[active] === 0 && (
        <p className="text-sm text-muted-foreground">
          No releases tagged “{active}” yet.
        </p>
      )}
    </>
  );
}
