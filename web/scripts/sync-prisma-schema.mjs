// Keep web/prisma/schema.prisma in sync with the backend's root schema.
//
// In the monorepo (local dev / CI from repo root) the root schema at
// ../prisma/schema.prisma is the single source of truth, so we copy it in.
// In a standalone web deploy (e.g. Railway service rooted at web/), the parent
// prisma/ directory isn't in the build context — we keep the committed copy and
// skip silently. `prisma generate` then resolves ./prisma/schema.prisma either way.
import { existsSync, copyFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootSchema = join(webRoot, "..", "prisma", "schema.prisma");
const localSchema = join(webRoot, "prisma", "schema.prisma");

if (existsSync(rootSchema)) {
  const incoming = readFileSync(rootSchema, "utf8");
  const current = existsSync(localSchema) ? readFileSync(localSchema, "utf8") : "";
  if (incoming !== current) {
    copyFileSync(rootSchema, localSchema);
    console.log("[sync-prisma-schema] synced web/prisma/schema.prisma from root");
  } else {
    console.log("[sync-prisma-schema] web schema already up to date");
  }
} else {
  console.log(
    "[sync-prisma-schema] root schema not in build context — using committed web/prisma/schema.prisma",
  );
}
