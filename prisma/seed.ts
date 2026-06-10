import { PrismaClient, Bucket } from "@prisma/client";

const prisma = new PrismaClient();

// System categories, each pre-assigned to a 50/30/20 bucket.
const SYSTEM_CATEGORIES: Array<{ name: string; bucket: Bucket }> = [
  // Needs
  { name: "Rent", bucket: "NEEDS" },
  { name: "Groceries", bucket: "NEEDS" },
  { name: "Utilities", bucket: "NEEDS" },
  { name: "Transport", bucket: "NEEDS" },
  { name: "EMI", bucket: "NEEDS" },
  // Wants
  { name: "Food", bucket: "WANTS" },
  { name: "Entertainment", bucket: "WANTS" },
  { name: "Shopping", bucket: "WANTS" },
  { name: "Subscriptions", bucket: "WANTS" },
  // Savings
  { name: "Savings", bucket: "SAVINGS" },
  { name: "Investment", bucket: "SAVINGS" },
];

async function main() {
  for (const cat of SYSTEM_CATEGORIES) {
    // System categories have userId = null. The [userId, name] unique constraint
    // treats NULL userId rows as distinct in Postgres, so guard on existence.
    const existing = await prisma.category.findFirst({
      where: { userId: null, name: cat.name },
    });
    if (existing) {
      if (existing.bucket !== cat.bucket) {
        await prisma.category.update({
          where: { id: existing.id },
          data: { bucket: cat.bucket },
        });
      }
      continue;
    }
    await prisma.category.create({
      data: { name: cat.name, bucket: cat.bucket, isSystem: true },
    });
  }
  console.log(`Seeded ${SYSTEM_CATEGORIES.length} system categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
