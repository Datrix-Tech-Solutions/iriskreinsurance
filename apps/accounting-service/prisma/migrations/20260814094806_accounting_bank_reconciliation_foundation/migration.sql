-- CreateEnum
CREATE TYPE "accounting"."BankReconciliationStatus" AS ENUM ('DRAFT', 'COMPLETED', 'VOID');

-- CreateEnum
CREATE TYPE "accounting"."BankStatementLineStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

-- CreateTable
CREATE TABLE "accounting"."BankReconciliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "statementReference" TEXT NOT NULL,
    "statementStartDate" TIMESTAMP(3) NOT NULL,
    "statementEndDate" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(20,4) NOT NULL,
    "closingBalance" DECIMAL(20,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "accounting"."BankReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "completedByUserId" TEXT,
    "voidedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."BankStatementLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3),
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT,
    "bankReference" TEXT,
    "counterpartyName" TEXT,
    "runningBalance" DECIMAL(20,4),
    "sourceFingerprint" TEXT NOT NULL,
    "status" "accounting"."BankStatementLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankReconciliation_tenantId_cashAccountId_status_statementE_idx" ON "accounting"."BankReconciliation"("tenantId", "cashAccountId", "status", "statementEndDate");

-- CreateIndex
CREATE INDEX "BankReconciliation_tenantId_status_statementEndDate_idx" ON "accounting"."BankReconciliation"("tenantId", "status", "statementEndDate");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliation_id_tenantId_key" ON "accounting"."BankReconciliation"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliation_tenantId_cashAccountId_statementReferenc_key" ON "accounting"."BankReconciliation"("tenantId", "cashAccountId", "statementReference");

-- CreateIndex
CREATE INDEX "BankStatementLine_tenantId_reconciliationId_status_transact_idx" ON "accounting"."BankStatementLine"("tenantId", "reconciliationId", "status", "transactionDate");

-- CreateIndex
CREATE INDEX "BankStatementLine_tenantId_bankReference_idx" ON "accounting"."BankStatementLine"("tenantId", "bankReference");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_id_tenantId_key" ON "accounting"."BankStatementLine"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_reconciliationId_lineNumber_key" ON "accounting"."BankStatementLine"("reconciliationId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_tenantId_reconciliationId_sourceFingerpri_key" ON "accounting"."BankStatementLine"("tenantId", "reconciliationId", "sourceFingerprint");

-- AddForeignKey
ALTER TABLE "accounting"."BankReconciliation" ADD CONSTRAINT "BankReconciliation_cashAccountId_tenantId_fkey" FOREIGN KEY ("cashAccountId", "tenantId") REFERENCES "accounting"."AccountingCashAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."BankStatementLine" ADD CONSTRAINT "BankStatementLine_reconciliationId_tenantId_fkey" FOREIGN KEY ("reconciliationId", "tenantId") REFERENCES "accounting"."BankReconciliation"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
