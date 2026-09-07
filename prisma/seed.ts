import { PrismaClient } from "@prisma/client";
import { CATEGORY_TEMPLATE } from "../src/domain/categoryTemplate";
import { INCOME_CATEGORY_TEMPLATE } from "../src/domain/incomeCategoryTemplate";

const prisma = new PrismaClient();

// Seeds the SYSTEM category taxonomy (userId = null): each parent group plus its
// leaf children, linked via parentId. Idempotent — existing system rows (incl.
// the old flat ones like "Rent") are reconciled in place, never duplicated.
async function upsertSystemCategory(data: {
  name: string;
  bucket: "NEEDS" | "WANTS" | "SAVINGS";
  isGroup: boolean;
  parentId: string | null;
  weight: number;
}) {
  const existing = await prisma.category.findFirst({
    where: { userId: null, name: data.name },
  });
  if (existing) {
    await prisma.category.update({
      where: { id: existing.id },
      data: {
        bucket: data.bucket,
        isGroup: data.isGroup,
        isSystem: true,
        parentId: data.parentId,
        weight: data.weight,
      },
    });
    return existing.id;
  }
  const created = await prisma.category.create({
    data: {
      name: data.name,
      bucket: data.bucket,
      isGroup: data.isGroup,
      isSystem: true,
      parentId: data.parentId,
      weight: data.weight,
    },
  });
  return created.id;
}

// Seeds the SYSTEM income taxonomy (userId = null). Idempotent, and it reconciles
// countsAsEarnings in place — that flag is the budget rule, so a template change
// has to reach existing rows rather than only new ones. Not prisma.upsert: the
// unique key is (userId, name) and Prisma will not take a null in a compound
// unique where.
async function seedIncomeCategories(): Promise<void> {
  for (const { name, countsAsEarnings } of INCOME_CATEGORY_TEMPLATE) {
    const existing = await prisma.incomeCategory.findFirst({
      where: { userId: null, name },
    });
    if (existing) {
      await prisma.incomeCategory.update({
        where: { id: existing.id },
        data: { countsAsEarnings },
      });
    } else {
      await prisma.incomeCategory.create({ data: { name, countsAsEarnings } });
    }
  }
}

async function main() {
  let groups = 0;
  let leaves = 0;
  for (const group of CATEGORY_TEMPLATE) {
    const groupId = await upsertSystemCategory({
      name: group.name,
      bucket: group.bucket,
      isGroup: true,
      parentId: null,
      weight: 0,
    });
    groups++;
    for (const child of group.children) {
      await upsertSystemCategory({
        name: child.name,
        bucket: child.bucket,
        isGroup: false,
        parentId: groupId,
        weight: child.weight,
      });
      leaves++;
    }
  }
  await seedIncomeCategories();
  console.log(
    `Seeded ${groups} system groups, ${leaves} leaf categories, and ${INCOME_CATEGORY_TEMPLATE.length} income categories.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
