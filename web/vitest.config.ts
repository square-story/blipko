import { defineConfig } from "vitest/config";
import path from "node:path";

// Only the pure modules are collected. `lib/time.ts` and `lib/insights.ts` are
// deliberately Prisma-free so they can be tested without a database or a
// Next.js request context.
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
