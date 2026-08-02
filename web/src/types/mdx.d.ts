// Augments the `declare module "*.mdx"` that @types/mdx provides (ambient
// external module declarations merge) so `import * as entry from "./x.mdx"`
// exposes the `export const meta` our changelog entries declare.
//
// Typed `unknown` on purpose: the real shape is enforced by the zod schema in
// @/lib/changelog, so a malformed `meta` fails the build instead of being
// silently cast to something it isn't.
declare module "*.mdx" {
  export const meta: unknown;
}
