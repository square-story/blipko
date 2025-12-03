import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill of contact balances...");

  const contacts = await prisma.contact.findMany({
    include: {
      transactions: {
        where: {
          isDeleted: false,
        },
      },
    },
  });

  console.log(`Found ${contacts.length} contacts.`);

  for (const contact of contacts) {
    let balance = new Decimal(0);

    for (const tx of contact.transactions) {
      if (tx.intent === "CREDIT") {
        // I gave money (positive balance)
        balance = balance.plus(tx.amount);
      } else if (tx.intent === "DEBIT") {
        // I received money (negative balance)
        balance = balance.minus(tx.amount);
      }
    }

    if (!balance.equals(contact.currentBalance)) {
      console.log(
        `Updating contact ${contact.name} (${contact.id}): ${contact.currentBalance} -> ${balance}`,
      );
      await prisma.contact.update({
        where: { id: contact.id },
        data: { currentBalance: balance },
      });
    } else {
      console.log(
        `Contact ${contact.name} (${contact.id}) is already up to date.`,
      );
    }
  }

  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
