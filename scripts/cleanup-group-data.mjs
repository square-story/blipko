// One-time, idempotent cleanup: groups are organization-only and must never hold
// spend or a budget. Detaches any expenses wrongly attached to a group row (they
// become uncategorized → surface in Needs Review) and clears budgets set on group
// rows. Safe to run more than once. Run against each environment's DB:
//   node scripts/cleanup-group-data.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.category.findMany({
    where: { isGroup: true },
    select: { id: true },
  });
  const ids = groups.map((g) => g.id);

  const detached = await prisma.expense.updateMany({
    where: { categoryId: { in: ids } },
    data: { categoryId: null },
  });
  const cleared = await prisma.category.updateMany({
    where: { isGroup: true, monthlyBudget: { not: null } },
    data: { monthlyBudget: null },
  });

  console.log(
    `Detached ${detached.count} expense(s) from group rows; cleared ${cleared.count} group budget(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
