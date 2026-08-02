import { cloudinaryPosterUrl, cloudinaryVideoUrl } from "@/lib/cloudinary";

import { MediaFallback } from "./media-fallback";

type MdxVideoProps = {
  /** Cloudinary public ID, e.g. "blipko/changelog/boxes.mp4" (extension optional). */
  id: string;
  /** Visible caption. Required — it doubles as the accessible description. */
  caption: string;
  /** Seconds into the clip to grab the poster frame from. */
  posterOffset?: number;
  /** WebVTT URL. Only needed when the clip has narration. */
  captions?: string;
};

/**
 * A Server Component with zero client JS. `controls` rather than autoplay:
 * nothing moves until asked, which is both reduced-motion friendly and kind to
 * mobile data. preload="metadata" so the index page — which renders every
 * entry body — fetches posters, not megabytes of video.
 */
export function MdxVideo({
  id,
  caption,
  posterOffset = 0,
  captions,
}: MdxVideoProps) {
  const mp4 = cloudinaryVideoUrl(id, "mp4");
  const webm = cloudinaryVideoUrl(id, "webm");

  if (!mp4) return <MediaFallback label={caption} />;

  return (
    <figure className="not-prose my-6 space-y-2">
      <video
        className="aspect-video w-full rounded-md border bg-muted"
        controls
        loop
        muted
        playsInline
        preload="metadata"
        poster={cloudinaryPosterUrl(id, posterOffset) || undefined}
        aria-label={caption}
      >
        {/* webm first: browsers take the first they can play, and VP9 is smaller. */}
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
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
