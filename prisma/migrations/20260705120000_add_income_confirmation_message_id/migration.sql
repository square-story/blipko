-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "confirmationMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Income_confirmationMessageId_key" ON "Income"("confirmationMessageId");
