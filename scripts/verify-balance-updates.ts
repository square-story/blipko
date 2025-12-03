import { PrismaClient, Intent } from "@prisma/client";
import { PrismaTransactionRepository } from "../src/data/repositories/PrismaTransactionRepository";

const prisma = new PrismaClient();
const repo = new PrismaTransactionRepository(prisma);

async function main() {
  console.log("Starting balance update verification...");

  // 1. Create a test user and contact
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      name: "Test User",
    },
  });

  const contact = await prisma.contact.create({
    data: {
      userId: user.id,
      name: "Test Contact",
      currentBalance: 0,
    },
  });

  console.log(
    `Created contact: ${contact.name} (${contact.id}), Balance: ${contact.currentBalance}`,
  );

  // 2. Create a CREDIT transaction (I gave money)
  console.log("\nCreating CREDIT transaction (100)...");
  const tx1 = await repo.create({
    userId: user.id,
    amount: 100,
    intent: Intent.CREDIT,
    contactId: contact.id,
    category: "Test",
  });

  let updatedContact = await prisma.contact.findUnique({
    where: { id: contact.id },
  });
  console.log(
    `Contact Balance after CREDIT: ${updatedContact?.currentBalance} (Expected: 100)`,
  );

  // 3. Create a DEBIT transaction (I received money)
  console.log("\nCreating DEBIT transaction (50)...");
  const tx2 = await repo.create({
    userId: user.id,
    amount: 50,
    intent: Intent.DEBIT,
    contactId: contact.id,
    category: "Test",
  });

  updatedContact = await prisma.contact.findUnique({
    where: { id: contact.id },
  });
  console.log(
    `Contact Balance after DEBIT: ${updatedContact?.currentBalance} (Expected: 50)`,
  );

  // 4. Update transaction (Change DEBIT 50 to 20)
  console.log("\nUpdating DEBIT transaction (50 -> 20)...");
  await repo.update(tx2.id, { amount: 20 });

  updatedContact = await prisma.contact.findUnique({
    where: { id: contact.id },
  });
  console.log(
    `Contact Balance after Update: ${updatedContact?.currentBalance} (Expected: 80)`,
  );

  // 5. Delete transaction
  console.log("\nDeleting CREDIT transaction...");
  await repo.delete(tx1.id);

  updatedContact = await prisma.contact.findUnique({
    where: { id: contact.id },
  });
  console.log(
    `Contact Balance after Delete: ${updatedContact?.currentBalance} (Expected: -20)`,
  );

  // Cleanup
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.contact.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log("\nVerification complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
