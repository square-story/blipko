import type { MDXComponents } from "mdx/types";

import { MdxCallout } from "@/components/changelog/mdx-callout";
import { MdxDetails } from "@/components/changelog/mdx-details";
import { MdxImage } from "@/components/changelog/mdx-image";
import { MdxVideo } from "@/components/changelog/mdx-video";
import { MediaFallback } from "@/components/changelog/media-fallback";

// Required by @next/mdx for the App Router, and it must live at the project
// root or in src/ — this path is resolved by the bundler, not by our imports.
//
// Only media and custom blocks are mapped. Plain markdown elements (headings,
// paragraphs, lists, links, code) are styled by the `prose` class instead of
// being overridden here — see the token bridge at the end of globals.css.
export function useMDXComponents(): MDXComponents {
  return {
    // Remapped so plain markdown ![alt](/path) picks up the same treatment.
    img: MdxImage as MDXComponents["img"],
    Img: MdxImage,
    Video: MdxVideo,
    Callout: MdxCallout,
    Details: MdxDetails,
    // Draft-only screenshot slot. Reuses the Cloudinary fallback box so an
    // unshot section reads as a labelled gap instead of a broken <Img>.
    // A published entry should contain none.
    Shot: MediaFallback,
  };
}
