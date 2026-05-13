import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } });
  console.log(`Found ${users.length} users.`);

  let created = 0;
  for (const user of users) {
    const existing = await prisma.wallet.findFirst({
      where: { userId: user.id },
    });
    if (existing) continue;

    await prisma.wallet.create({
      data: {
        name: "Personal",
        emoji: "👤",
        type: "PERSONAL",
        isDefault: true,
        userId: user.id,
      },
    });
    created++;
  }

  console.log(`Created ${created} Personal wallets.`);

  // Link transactions with no walletId to the user's default wallet
  const orphans = await prisma.transaction.findMany({
    where: { walletId: null },
    select: { id: true, userId: true },
  });
  console.log(`Found ${orphans.length} transactions without a wallet.`);

  for (const tx of orphans) {
    const wallet = await prisma.wallet.findFirst({
      where: { userId: tx.userId, isDefault: true },
    });
    if (!wallet) continue;
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { walletId: wallet.id },
    });
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
