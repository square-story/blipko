import { Prisma } from "@prisma/client";

// Merges a Telegram-only user (botUser) into the web user (webUser) within a
// transaction, keeping the bot's financial profile, then assigns the telegramId
// to the web user and deletes the orphan. Used by both the link flow
// (PrismaUserRepository.linkTelegramByToken) and the one-off data migration.
//
// Ordering matters: children are reassigned before the bot user is deleted (so
// nothing cascades away), and the bot's unique telegramId is cleared before it
// is set on the web user.
export async function mergeTelegramUser(
  tx: Prisma.TransactionClient,
  botUserId: string,
  webUserId: string,
  telegramId: string,
): Promise<void> {
  if (botUserId === webUserId) return;

  // 1. Reassign simple child rows.
  await tx.expense.updateMany({
    where: { userId: botUserId },
    data: { userId: webUserId },
  });
  await tx.income.updateMany({
    where: { userId: botUserId },
    data: { userId: webUserId },
  });
  await tx.parseLog.updateMany({
    where: { userId: botUserId },
    data: { userId: webUserId },
  });
  await tx.conversationMessage.updateMany({
    where: { userId: botUserId },
    data: { userId: webUserId },
  });
  await tx.budgetNudge.updateMany({
    where: { userId: botUserId },
    data: { userId: webUserId },
  });

  // 2. Custom categories (system categories have userId null and are shared).
  const botCats = await tx.category.findMany({ where: { userId: botUserId } });
  for (const cat of botCats) {
    const existing = await tx.category.findFirst({
      where: { userId: webUserId, name: cat.name },
    });
    if (existing) {
      // Web already has a category with this name: repoint the moved expenses
      // and drop the duplicate to avoid the [userId, name] unique conflict.
      await tx.expense.updateMany({
        where: { categoryId: cat.id },
        data: { categoryId: existing.id },
      });
      await tx.category.delete({ where: { id: cat.id } });
    } else {
      await tx.category.update({
        where: { id: cat.id },
        data: { userId: webUserId },
      });
    }
  }

  // 3. Keep the bot's financial profile: move its BudgetConfig and copy income/locale.
  const botUser = await tx.user.findUnique({ where: { id: botUserId } });
  const botConfig = await tx.budgetConfig.findUnique({
    where: { userId: botUserId },
  });
  if (botConfig) {
    await tx.budgetConfig.deleteMany({ where: { userId: webUserId } });
    await tx.budgetConfig.update({
      where: { userId: botUserId },
      data: { userId: webUserId },
    });
  }
  if (botUser) {
    await tx.user.update({
      where: { id: webUserId },
      data: {
        monthlyIncome: botUser.monthlyIncome,
        currency: botUser.currency,
        locale: botUser.locale,
        payday: botUser.payday,
        hasOnboarded: true,
      },
    });
  }

  // 4. Free the unique telegramId, then assign it to the web user.
  await tx.user.update({
    where: { id: botUserId },
    data: { telegramId: null },
  });
  await tx.user.update({
    where: { id: webUserId },
    data: { telegramId },
  });

  // 5. Delete the now-empty orphan.
  await tx.user.delete({ where: { id: botUserId } });
}
