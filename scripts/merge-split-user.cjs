// One-off: merge the Telegram-only user into the Google web account so the
// 12 bot-logged expenses show in the dashboard. Reuses the same merge logic as
// the link flow (compiled to dist/). Idempotent — a no-op once merged.
//
// Run from the repo root after `pnpm build`:
//   node scripts/merge-split-user.cjs
const path = require("path");
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { mergeTelegramUser } = require(
  path.join(__dirname, "..", "dist", "data", "repositories", "mergeTelegramUser.js"),
);

const TELEGRAM_ID = "542001938";
const WEB_EMAIL = "gibmepreo@gmail.com";

(async () => {
  const prisma = new PrismaClient();
  try {
    const botUser = await prisma.user.findUnique({
      where: { telegramId: TELEGRAM_ID },
    });
    const webUser = await prisma.user.findUnique({ where: { email: WEB_EMAIL } });

    if (!botUser) {
      console.log("No Telegram-only user with that id — already merged. No-op.");
      return;
    }
    if (!webUser) {
      console.error(`Web user not found: ${WEB_EMAIL}`);
      process.exit(1);
    }
    if (botUser.id === webUser.id) {
      console.log("Already the same user. No-op.");
      return;
    }

    console.log(`Merging bot ${botUser.id} → web ${webUser.id} ...`);
    await prisma.$transaction(
      (tx) => mergeTelegramUser(tx, botUser.id, webUser.id, TELEGRAM_ID),
      { timeout: 30000 },
    );
    console.log("Merge complete.");
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
