-- CreateEnum
CREATE TYPE "NotificationDosage" AS ENUM ('OFF', 'GENTLE', 'AGGRESSIVE', 'RELENTLESS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NudgeKind" ADD VALUE 'WARN_50';
ALTER TYPE "NudgeKind" ADD VALUE 'CHECKIN';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyBudget" DECIMAL(12,2),
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationDosage" "NotificationDosage" NOT NULL DEFAULT 'OFF',
ADD COLUMN     "onboardingDraft" JSONB,
ADD COLUMN     "onboardingStep" TEXT;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
