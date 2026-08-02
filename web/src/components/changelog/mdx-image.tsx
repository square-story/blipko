import Image from "next/image";

import { cloudinaryImageUrl } from "@/lib/cloudinary";

import { MediaFallback } from "./media-fallback";

type MdxImageProps = {
  /** Cloudinary public ID, e.g. "blipko/changelog/boxes.png". */
  id?: string;
  /**
   * Either a Cloudinary public ID, an absolute https URL, or a path rooted in
   * `public/` (e.g. "/screenshot03.png"). Also what markdown `![]()` passes.
   */
  src?: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
};

export function MdxImage({
  id,
  src,
  alt,
  width = 1600,
  height = 900,
  caption,
}: MdxImageProps) {
  const raw = id ?? src ?? "";
  // Absolute URLs and public/ paths are already resolvable; anything else is a
  // Cloudinary public ID.
  const isDirect = raw.startsWith("http") || raw.startsWith("/");
  const url = isDirect ? raw : cloudinaryImageUrl(raw);

  if (!url) return <MediaFallback label={alt} />;

  const image = (
    <Image
      src={url}
      alt={alt}
      width={width}
      height={height}
      sizes="(min-width: 768px) 42rem, 100vw"
      className="h-auto w-full rounded-md border"
    />
  );

  // not-prose: the figure owns its own margins, so prose shouldn't add more.
  return caption ? (
    <figure className="not-prose my-6 space-y-2">
      {image}
      <figcaption className="text-sm text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  ) : (
    image
  );
}
