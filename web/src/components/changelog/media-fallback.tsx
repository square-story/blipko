/**
 * Stands in for changelog media when Cloudinary isn't configured. Deliberately
 * a placeholder rather than a thrown error: every changelog page is
 * prerendered, so throwing would fail `next build` outright for a fresh clone
 * or a preview deploy that hasn't set the env var yet.
 */
export function MediaFallback({ label }: { label: string }) {
  return (
    <div className="not-prose my-6 flex aspect-video w-full items-center justify-center rounded-md border bg-muted px-6 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
