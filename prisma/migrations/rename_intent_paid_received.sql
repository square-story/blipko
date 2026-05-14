-- Rename CREDIT→PAID, DEBIT→RECEIVED in the Intent enum
-- PostgreSQL cannot drop enum values directly, so we rebuild the type.

-- 1. Add new values alongside existing ones
ALTER TYPE "Intent" ADD VALUE 'PAID';
ALTER TYPE "Intent" ADD VALUE 'RECEIVED';

-- 2. Backfill existing rows
UPDATE "Transaction" SET "intent" = 'PAID'     WHERE "intent" = 'CREDIT';
UPDATE "Transaction" SET "intent" = 'RECEIVED'  WHERE "intent" = 'DEBIT';

-- 3. Detach column from enum so we can rebuild the type
ALTER TABLE "Transaction" ALTER COLUMN "intent" TYPE TEXT;

-- 4. Rebuild the enum without the old values
DROP TYPE "Intent";
CREATE TYPE "Intent" AS ENUM ('PAID', 'RECEIVED', 'UNDO');

-- 5. Re-attach column to new enum
ALTER TABLE "Transaction" ALTER COLUMN "intent" TYPE "Intent" USING "intent"::"Intent";
