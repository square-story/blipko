import { ImageResponse } from "next/og";

import { getAllChangelogEntries, getChangelogEntry } from "@/lib/changelog";
import { formatDate } from "@/lib/format";

export const alt = "Blipko changelog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Declared here too rather than inherited from the page.
export function generateStaticParams() {
  return getAllChangelogEntries().map((entry) => ({ slug: entry.slug }));
}

// Satori has no access to our CSS, so: inline styles only, hex instead of
// oklch(), and the font next/og already bundles (no network fetch at build).
const INK = "#fafafa";
const CANVAS = "#0a0a0a";
const MUTED = "#a1a1a1";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getChangelogEntry(slug);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CANVAS,
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
          Blipko · Changelog
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            lineHeight: 1.15,
            color: INK,
            letterSpacing: "-0.02em",
          }}
        >
          {entry?.title ?? "Changelog"}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
          {entry ? formatDate(entry.date, { timeZone: "UTC" }) : ""}
        </div>
      </div>
    ),
    size,
  );
}
