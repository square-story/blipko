-- AlterTable
ALTER TABLE "RecurringRule" ADD COLUMN     "incomeCategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_incomeCategoryId_fkey" FOREIGN KEY ("incomeCategoryId") REFERENCES "IncomeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An INCOME rule could never have held a valid expense category or bucket, but
-- PendingActionProcessor resolved the assistant's category name against the
-- expense taxonomy regardless of kind and wrote both. Clear what it left.
UPDATE "RecurringRule" SET "categoryId" = NULL, "bucket" = NULL WHERE "kind" = 'INCOME';
