-- AlterTable
ALTER TABLE "User" ADD COLUMN     "balanceAnchor" DECIMAL(12,2),
ADD COLUMN     "balanceAnchorAt" TIMESTAMP(3);
