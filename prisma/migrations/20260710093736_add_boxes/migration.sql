/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Income` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BoxEntryDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "BoxEntrySource" AS ENUM ('MANUAL', 'LINKED');

-- DropForeignKey
ALTER TABLE "Income" DROP CONSTRAINT "Income_categoryId_fkey";

-- DropIndex
DROP INDEX "Income_userId_categoryId_idx";

-- AlterTable
ALTER TABLE "Income" DROP COLUMN "categoryId";

-- CreateTable
CREATE TABLE "Box" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "targetAmount" DECIMAL(12,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "targetReachedAt" TIMESTAMP(3),
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Box_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoxEntry" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "direction" "BoxEntryDirection" NOT NULL,
    "source" "BoxEntrySource" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "rawText" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoxEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Box_categoryId_key" ON "Box"("categoryId");

-- CreateIndex
CREATE INDEX "Box_userId_isActive_idx" ON "Box"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Box_userId_name_key" ON "Box"("userId", "name");

-- CreateIndex
CREATE INDEX "BoxEntry_boxId_isDeleted_date_idx" ON "BoxEntry"("boxId", "isDeleted", "date");

-- CreateIndex
CREATE INDEX "BoxEntry_userId_date_idx" ON "BoxEntry"("userId", "date");

-- AddForeignKey
ALTER TABLE "Box" ADD CONSTRAINT "Box_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Box" ADD CONSTRAINT "Box_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxEntry" ADD CONSTRAINT "BoxEntry_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxEntry" ADD CONSTRAINT "BoxEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
