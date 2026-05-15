-- CreateIndex
CREATE UNIQUE INDEX "DueEntry_chargeId_dueDate_key" ON "DueEntry"("chargeId", "dueDate");
