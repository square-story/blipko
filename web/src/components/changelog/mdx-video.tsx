import { cloudinaryPosterUrl, cloudinaryVideoUrl } from "@/lib/cloudinary";

import { MediaFallback } from "./media-fallback";

type MdxVideoProps = {
  /**
   * Cloudinary public ID (e.g. "blipko/changelog/boxes.mp4"), an absolute
   * https URL, or a path rooted in public/ (e.g. "/changelog/wrapped.mp4").
   * Mirrors what <Img> accepts.
   */
  id?: string;
  /** Alias for `id`, to match <Img>'s prop name. */
  src?: string;
  /** Visible caption. Required — it doubles as the accessible description. */
  caption: string;
  /** Seconds into the clip to grab the poster frame from (Cloudinary only). */
  posterOffset?: number;
  /** Explicit poster image. Derived automatically for Cloudinary public IDs. */
  poster?: string;
  /** WebVTT URL. Only needed when the clip has narration. */
  captions?: string;
};

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
};

function mimeFor(url: string): string {
  const ext = url.split("?")[0]!.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "video/mp4";
}

/**
 * A Server Component with zero client JS. `controls` rather than autoplay:
 * nothing moves until asked, which is both reduced-motion friendly and kind to
 * mobile data. preload="metadata" so the index page — which renders every
 * entry body — fetches posters, not megabytes of video.
 */
export function MdxVideo({
  id,
  src,
  caption,
  posterOffset = 0,
  poster,
  captions,
}: MdxVideoProps) {
  const raw = id ?? src ?? "";
  // Absolute URLs and public/ paths are already resolvable; anything else is a
  // Cloudinary public ID we can transcode and derive a poster frame from.
  const isDirect = raw.startsWith("http") || raw.startsWith("/");

  const sources = isDirect
    ? [{ src: raw, type: mimeFor(raw) }]
    : [
        // webm first: browsers take the first they can play, and VP9 is smaller.
        { src: cloudinaryVideoUrl(raw, "webm"), type: "video/webm" },
        { src: cloudinaryVideoUrl(raw, "mp4"), type: "video/mp4" },
      ].filter((s) => s.src);

  if (sources.length === 0) return <MediaFallback label={caption} />;

  const posterUrl =
    poster ?? (isDirect ? undefined : cloudinaryPosterUrl(raw, posterOffset));

  return (
    <figure className="not-prose my-6 space-y-2">
      <video
        className="aspect-video w-full rounded-md border bg-muted"
        controls
        loop
        muted
        playsInline
        preload="metadata"
        poster={posterUrl || undefined}
        aria-label={caption}
      >
        {sources.map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
        {captions ? (
          <track kind="captions" srcLang="en" src={captions} default />
        ) : null}
      </video>
      <figcaption className="text-sm text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}
