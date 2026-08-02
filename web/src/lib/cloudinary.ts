const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const BASE = "https://res.cloudinary.com";

if (process.env.NODE_ENV === "development" && !CLOUD_NAME) {
  console.warn(
    "[cloudinary] NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is unset — changelog media will render placeholders.",
  );
}

export const isCloudinaryConfigured = Boolean(CLOUD_NAME);

/** Drop a trailing media extension so we can request an explicit format. */
function stripExtension(publicId: string): string {
  return publicId.replace(/\.(mp4|webm|mov|m4v|png|jpe?g|webp|avif|gif)$/i, "");
}

/**
 * Delivery URL for an image public ID. Returns "" when Cloudinary isn't
 * configured — callers render a placeholder rather than crashing the build.
 */
export function cloudinaryImageUrl(
  publicId: string,
  transform = "f_auto,q_auto",
): string {
  if (!CLOUD_NAME || !publicId) return "";
  return `${BASE}/${CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}

/** Video URL with an explicit container so <source type> is honest. */
export function cloudinaryVideoUrl(
  publicId: string,
  format: "mp4" | "webm" = "mp4",
  transform = "q_auto",
): string {
  if (!CLOUD_NAME || !publicId) return "";
  return `${BASE}/${CLOUD_NAME}/video/upload/${transform}/${stripExtension(publicId)}.${format}`;
}

/**
 * Poster frame grabbed `offsetSeconds` into the clip. Forced to .jpg rather
 * than f_auto: poster fetches don't negotiate content types reliably, and
 * f_auto alongside an explicit extension conflicts.
 */
export function cloudinaryPosterUrl(
  publicId: string,
  offsetSeconds = 0,
): string {
  if (!CLOUD_NAME || !publicId) return "";
  return `${BASE}/${CLOUD_NAME}/video/upload/so_${offsetSeconds},q_auto/${stripExtension(publicId)}.jpg`;
}
