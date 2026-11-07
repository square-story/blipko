-- DropForeignKey
ALTER TABLE "ParseLog" DROP CONSTRAINT "ParseLog_userId_fkey";

-- AddForeignKey
ALTER TABLE "ParseLog" ADD CONSTRAINT "ParseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
