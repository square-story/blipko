-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "Income_userId_categoryId_idx" ON "Income"("userId", "categoryId");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
