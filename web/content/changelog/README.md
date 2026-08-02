# Writing a release note

One `.mdx` file per release. Rendered at `/changelog` and `/changelog/<slug>`,
and syndicated to `/changelog/feed.xml`.

## The `meta` contract

Every entry starts with an `export const meta`. It is plain JavaScript, not YAML
— keys need commas, strings need quotes. A mistake is a compile error with a
line number, which is the point.

| Key | Type | Required | Rules |
| --- | --- | --- | --- |
| `slug` | string | yes | lowercase kebab-case. **This is the permalink and is permanent.** |
| `title` | string | yes | 1–80 chars, sentence case, no trailing period |
| `date` | string | yes | `YYYY-MM-DD`, the ship date. Drives ordering. |
| `summary` | string | yes | 1–200 chars, one sentence. Used for RSS, the meta description, and the in-app panel. |
| `tags` | string[] | yes | one or more of `Feature`, `Improvement`, `Fix`, `Performance` |
| `cover` | string | no | Cloudinary public ID for the social card |

There is no `version` field on purpose — releases are labelled by date.

The tag list is closed, defined in `src/lib/changelog-tags.ts`. A typo fails the
build rather than creating a filter chip that matches nothing.

## Shipping one

1. **Upload media to Cloudinary** under `blipko/changelog/`. Note the public ID
   (e.g. `blipko/changelog/boxes.mp4`) and, for images, the pixel dimensions.
   Screenshots already in `public/` can be referenced by path instead.
2. **Create `YYYY-MM-DD-short-name.mdx`** in this directory. The date prefix is
   only so the folder sorts chronologically in your editor — routing uses
   `meta.slug`.
3. **Write it.** Template:

   ```mdx
   export const meta = {
     slug: "savings-boxes",
     title: "Savings boxes",
     date: "2026-07-30",
     summary: "Set money aside for a goal and watch the box fill up.",
     tags: ["Feature"],
   };

   One or two sentences on why this matters to someone using Blipko.

   <Video
     id="blipko/changelog/boxes.mp4"
     caption="Creating a box, then moving a transaction into it."
   />

   - **The headline thing** and what it does
   - The second thing

   ### Fixed

   - The bug, described from the user's side
   ```

4. **Register it** in `src/lib/changelog.ts` — add the `import * as x from
   "../../content/changelog/….mdx"` line, then add `x` to the `modules` array.
   Skip this and the entry silently won't appear anywhere; you'll notice
   immediately in dev.
5. `pnpm dev` → <http://localhost:3000/changelog>. Editing the `.mdx`
   hot-reloads.
6. `pnpm lint && pnpm build` before you push.

## Components available

Standard markdown works and is styled by `prose` — reach for HTML only if you
must.

```mdx
<Img
  id="blipko/changelog/dashboard.png"   {/* or src="/screenshot03.png" */}
  alt="Required. Describes the image."
  width={2400}
  height={1350}
  caption="Optional."
/>

<Video
  id="blipko/changelog/boxes.mp4"   {/* or src="https://…" or src="/changelog/clip.mp4" */}
  caption="Required — it's the accessible description too."
  posterOffset={1.5}   {/* seconds; Cloudinary public IDs only */}
/>

<Callout variant="info">Also: success, warning, error.</Callout>

<Details summary="The full fix list">
  Collapsed by default.
</Details>
```

Both `<Img>` and `<Video>` take either a **Cloudinary public ID**
(`blipko/changelog/boxes.mp4`) or something already resolvable — an absolute
`https://` URL, or a path in `public/` (`/screenshot03.png`). Public IDs get
`f_auto,q_auto`, a webm alternate, and an auto-derived poster frame; direct URLs
are used verbatim, so they work with no env var set.

Pass real `width`/`height` on images (Cloudinary's media library shows them) so
the browser reserves the right space and the page doesn't jump.

Videos should be **silent screencasts** — they render muted with controls. If a
clip has narration it needs captions: `captions="/path/to.vtt"`.

## Gotchas

- **`slug` is forever.** Changing it breaks every existing link, including ones
  already in someone's RSS reader.
- **`date` is the release date**, not the day you wrote the note. Everything
  sorts and paginates off it.
- **Media needs `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.** Without it, `<Img>` and
  `<Video>` render a labelled placeholder rather than crashing — so a missing
  env var never breaks the build, but it also won't tell you loudly.
- Entries are static imports, not a filesystem scan. That's why step 4 exists,
  and why editing an `.mdx` hot-reloads.
