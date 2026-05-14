/*
  Warnings:

  - You are about to drop the column `receiptUrl` on the `Contact` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "receiptUrl";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "receiptUrl" TEXT;
