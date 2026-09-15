-- Carry-forward prompt state. Holds the periodKey (cycle start date) of the
-- last cycle the user settled the prompt for; NULL means never settled.
--
-- No backfill: NULL is the correct starting value. Existing users are asked at
-- their next cycle start, because the prompt only fires inside the first days
-- of a cycle — it does not ambush anyone mid-cycle on deploy.
ALTER TABLE "User" ADD COLUMN     "carryDecidedKey" TEXT;
