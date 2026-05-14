UPDATE "Transaction" SET "intent" = 'PAID'     WHERE "intent" = 'CREDIT';
UPDATE "Transaction" SET "intent" = 'RECEIVED'  WHERE "intent" = 'DEBIT';

ALTER TABLE "Transaction" ALTER COLUMN "intent" TYPE TEXT;
DROP TYPE "Intent";
CREATE TYPE "Intent" AS ENUM ('PAID', 'RECEIVED', 'UNDO');
ALTER TABLE "Transaction" ALTER COLUMN "intent" TYPE "Intent" USING "intent"::"Intent";
