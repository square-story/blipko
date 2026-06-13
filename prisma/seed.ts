import { PrismaClient } from "@prisma/client";
import { CATEGORY_TEMPLATE } from "../src/domain/categoryTemplate";

const prisma = new PrismaClient();

// Seeds the SYSTEM category taxonomy (userId = null): each parent group plus its
// leaf children, linked via parentId. Idempotent — existing system rows (incl.
// the old flat ones like "Rent") are reconciled in place, never duplicated.
async function upsertSystemCategory(data: {
  name: string;
  bucket: "NEEDS" | "WANTS" | "SAVINGS";
  isGroup: boolean;
  parentId: string | null;
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
    },
  });
  return created.id;
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
    });
    groups++;
    for (const child of group.children) {
      await upsertSystemCategory({
        name: child.name,
        bucket: child.bucket,
        isGroup: false,
        parentId: groupId,
      });
      leaves++;
    }
  }
  console.log(`Seeded ${groups} system groups and ${leaves} leaf categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
