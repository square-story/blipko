-- CreateTable
CREATE TABLE "CategoryMemory" (
    "id" TEXT NOT NULL,
    "phraseKey" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryMemory_userId_hits_idx" ON "CategoryMemory"("userId", "hits");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryMemory_userId_phraseKey_key" ON "CategoryMemory"("userId", "phraseKey");

-- AddForeignKey
ALTER TABLE "CategoryMemory" ADD CONSTRAINT "CategoryMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryMemory" ADD CONSTRAINT "CategoryMemory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
