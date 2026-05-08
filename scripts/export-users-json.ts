import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function exportUsers() {
  console.log("Connecting to database...");

  const users = await prisma.user.findMany({
    include: {
      transactions: {
        where: { isDeleted: false },
        orderBy: { date: "desc" },
      },
      contacts: {
        where: { status: { not: "ARCHIVED" } },
      },
      organizations: {
        include: { units: true },
      },
    },
  });

  const backupsDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir);

  const date = new Date().toISOString().split("T")[0];
  const outputPath = path.join(backupsDir, `users-export-${date}.json`);

  const output = {
    exportedAt: new Date().toISOString(),
    totalUsers: users.length,
    totalTransactions: users.reduce((sum, u) => sum + u.transactions.length, 0),
    totalContacts: users.reduce((sum, u) => sum + u.contacts.length, 0),
    users,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`Exported ${users.length} users to ${outputPath}`);
  console.log(`  Transactions: ${output.totalTransactions}`);
  console.log(`  Contacts:     ${output.totalContacts}`);
}

exportUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
