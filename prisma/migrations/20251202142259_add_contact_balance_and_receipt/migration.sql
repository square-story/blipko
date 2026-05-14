-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "address" TEXT,
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'General',
ADD COLUMN     "currentBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "receiptUrl" TEXT,
ADD COLUMN     "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE';
