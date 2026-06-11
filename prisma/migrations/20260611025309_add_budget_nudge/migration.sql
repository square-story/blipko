-- CreateEnum
CREATE TYPE "NudgeKind" AS ENUM ('WARN_80', 'OVER');

-- CreateTable
CREATE TABLE "BudgetNudge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucket" "Bucket" NOT NULL,
    "kind" "NudgeKind" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetNudge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetNudge_userId_bucket_kind_periodKey_key" ON "BudgetNudge"("userId", "bucket", "kind", "periodKey");

-- AddForeignKey
ALTER TABLE "BudgetNudge" ADD CONSTRAINT "BudgetNudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
