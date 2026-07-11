-- AlterEnum
ALTER TYPE "RecurringKind" ADD VALUE 'BOX';

-- AlterTable
ALTER TABLE "BoxEntry" ADD COLUMN     "sourceExpenseId" TEXT,
ADD COLUMN     "sourceIncomeId" TEXT;

-- AlterTable
ALTER TABLE "RecurringRule" ADD COLUMN     "boxId" TEXT;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE SET NULL ON UPDATE CASCADE;
