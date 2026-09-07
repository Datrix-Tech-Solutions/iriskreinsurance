-- AlterTable
ALTER TABLE "accounting"."BankStatementLine"
  ADD COLUMN "matchedCashbookTransactionId" TEXT,
  ADD COLUMN "matchedByUserId" TEXT,
  ADD COLUMN "matchedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_reconciliationId_matchedCashbookTransactionId_key"
  ON "accounting"."BankStatementLine"("reconciliationId", "matchedCashbookTransactionId");

-- AddForeignKey
ALTER TABLE "accounting"."BankStatementLine"
  ADD CONSTRAINT "BankStatementLine_matchedCashbookTransactionId_tenantId_fkey"
  FOREIGN KEY ("matchedCashbookTransactionId", "tenantId")
  REFERENCES "accounting"."CashbookTransaction"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
