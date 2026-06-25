-- CreateIndex
CREATE INDEX "Expense_userId_isDeleted_date_idx" ON "Expense"("userId", "isDeleted", "date");

-- CreateIndex
CREATE INDEX "Income_userId_isDeleted_date_idx" ON "Income"("userId", "isDeleted", "date");
