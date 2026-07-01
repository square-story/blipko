-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "batchId" TEXT;

-- AlterTable
ALTER TABLE "ParseLog" ADD COLUMN     "batchId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_userId_batchId_idx" ON "Expense"("userId", "batchId");

-- CreateIndex
CREATE INDEX "Income_userId_batchId_idx" ON "Income"("userId", "batchId");
