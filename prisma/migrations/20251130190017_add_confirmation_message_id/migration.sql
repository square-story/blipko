/*
  Warnings:

  - A unique constraint covering the columns `[confirmationMessageId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "confirmationMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_confirmationMessageId_key" ON "Transaction"("confirmationMessageId");
