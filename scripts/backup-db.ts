import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(__dirname, "../backups", timestamp);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`Starting backup to ${backupDir}...`);

  const models = [
    "user",
    "account",
    "session",
    "verificationToken",
    "contact",
    "transaction",
    "parseLog",
    "processedMessage",
  ] as const;

  for (const model of models) {
    try {
      // @ts-ignore - Dynamic access to prisma models
      const data = await prisma[model].findMany();
      const filePath = path.join(backupDir, `${model}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✔ Backed up ${model} (${data.length} records)`);
    } catch (error) {
      console.error(`✘ Failed to backup ${model}:`, error);
    }
  }

  console.log("Backup completed!");
}

backup()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
