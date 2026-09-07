/**
 * One-off: tag existing Income rows that are NOT earnings.
 *
 * Only non-earning rows need a category — an uncategorised row already counts as
 * earnings, so writing "Salary" or "Other Income" onto one would change nothing.
 *
 * Deliberately NOT wired into preDeployCommand — it is a manual tool, so it
 * cannot fire on a deploy. Dry-runs by default; `--apply` is required to write.
 *
 *   pnpm exec ts-node-dev --transpile-only --exit-child scripts/backfill-income-categories.ts
 *   pnpm exec ts-node-dev --transpile-only --exit-child scripts/backfill-income-categories.ts --apply
 *
 * Targets whatever DATABASE_URL points at. Check that before running.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Ordered: first match wins, so the more specific phrases come first. These are
// intentionally conservative — anything that does not clearly read as money
// coming back is left alone and keeps counting as earnings.
const RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(advance)\b/i, category: "Loan / Advance Received" },
  { pattern: /\b(lend|lent|lending)\b/i, category: "Money Lent Returned" },
  { pattern: /\b(reimburse\w*)\b/i, category: "Reimbursement" },
  { pattern: /\b(refund\w*)\b/i, category: "Refund" },
  { pattern: /\b(returns?|returned)\b/i, category: "Money Lent Returned" },
];

async function main() {
  const categories = await prisma.incomeCategory.findMany({
    where: { userId: null },
  });
  if (categories.length === 0) {
    throw new Error("No system income categories — run the seed first.");
  }
  const byName = new Map(categories.map((c) => [c.name, c]));

  const rows = await prisma.income.findMany({
    where: { categoryId: null, isDeleted: false },
    select: { id: true, amount: true, rawText: true, source: true, note: true },
    orderBy: { date: "asc" },
  });

  let excluded = 0;
  for (const row of rows) {
    const text = [row.rawText, row.source, row.note].filter(Boolean).join(" ");
    const name = RULES.find((r) => r.pattern.test(text))?.category;
    if (!name) continue;
    const category = byName.get(name)!;
    excluded++;
    console.log(
      `  ${String(Number(row.amount)).padStart(9)}  ${name.padEnd(26)} ${JSON.stringify(text.slice(0, 48))}`,
    );
    if (APPLY) {
      await prisma.income.update({
        where: { id: row.id },
        data: { categoryId: category.id },
      });
    }
  }

  console.log(
    `\n${excluded} of ${rows.length} uncategorised row(s) are money coming back; the rest keep counting as earnings.`,
  );
  console.log(APPLY ? "Applied." : "Dry run — re-run with --apply to write.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
