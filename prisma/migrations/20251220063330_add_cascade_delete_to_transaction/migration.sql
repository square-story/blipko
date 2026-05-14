-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_contactId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hasOnboarded" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
