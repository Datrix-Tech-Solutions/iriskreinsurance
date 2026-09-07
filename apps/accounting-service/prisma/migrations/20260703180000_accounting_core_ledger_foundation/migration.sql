-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "accounting";

-- CreateEnum
CREATE TYPE "accounting"."FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "accounting"."GLAccountCategory" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "accounting"."NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "accounting"."RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "accounting"."SubledgerType" AS ENUM ('CUSTOMER', 'VENDOR', 'CEDANT', 'REINSURER', 'EMPLOYEE', 'STATUTORY', 'OTHER');

-- CreateEnum
CREATE TYPE "accounting"."JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateTable
CREATE TABLE "accounting"."AccountingTenantConfig" (
    "tenantId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingTenantConfig_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "accounting"."AccountingCurrency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingCurrency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."ExchangeRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."FiscalPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "accounting"."FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."GLAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "accounting"."GLAccountCategory" NOT NULL,
    "normalBalance" "accounting"."NormalBalance" NOT NULL,
    "parentAccountId" TEXT,
    "allowPosting" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "status" "accounting"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GLAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."CostCentre" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "externalRef" TEXT,
    "status" "accounting"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCentre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."SubledgerAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "accounting"."SubledgerType" NOT NULL,
    "externalRef" TEXT,
    "controlAccountId" TEXT NOT NULL,
    "currency" TEXT,
    "status" "accounting"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubledgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "journalNumber" TEXT NOT NULL,
    "status" "accounting"."JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "postingDate" TIMESTAMP(3),
    "fiscalPeriodId" TEXT NOT NULL,
    "transactionCurrency" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,8) NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "sourceModule" TEXT,
    "sourceRecordType" TEXT,
    "sourceRecordId" TEXT,
    "reversalOfJournalId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "postedByUserId" TEXT,
    "reversedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."JournalLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "subledgerAccountId" TEXT,
    "costCentreId" TEXT,
    "description" TEXT,
    "transactionDebit" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "transactionCredit" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "baseDebit" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "baseCredit" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingCurrency_tenantId_isActive_code_idx" ON "accounting"."AccountingCurrency"("tenantId", "isActive", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingCurrency_id_tenantId_key" ON "accounting"."AccountingCurrency"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingCurrency_tenantId_code_key" ON "accounting"."AccountingCurrency"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ExchangeRate_tenantId_fromCurrency_toCurrency_isActive_effe_idx" ON "accounting"."ExchangeRate"("tenantId", "fromCurrency", "toCurrency", "isActive", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_id_tenantId_key" ON "accounting"."ExchangeRate"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_tenantId_fromCurrency_toCurrency_effectiveAt_key" ON "accounting"."ExchangeRate"("tenantId", "fromCurrency", "toCurrency", "effectiveAt");

-- CreateIndex
CREATE INDEX "FiscalPeriod_tenantId_status_startDate_endDate_idx" ON "accounting"."FiscalPeriod"("tenantId", "status", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_id_tenantId_key" ON "accounting"."FiscalPeriod"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_tenantId_name_key" ON "accounting"."FiscalPeriod"("tenantId", "name");

-- CreateIndex
CREATE INDEX "GLAccount_tenantId_category_status_idx" ON "accounting"."GLAccount"("tenantId", "category", "status");

-- CreateIndex
CREATE INDEX "GLAccount_tenantId_parentAccountId_idx" ON "accounting"."GLAccount"("tenantId", "parentAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "GLAccount_id_tenantId_key" ON "accounting"."GLAccount"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GLAccount_tenantId_code_key" ON "accounting"."GLAccount"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CostCentre_tenantId_status_name_idx" ON "accounting"."CostCentre"("tenantId", "status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CostCentre_id_tenantId_key" ON "accounting"."CostCentre"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCentre_tenantId_code_key" ON "accounting"."CostCentre"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SubledgerAccount_tenantId_type_status_idx" ON "accounting"."SubledgerAccount"("tenantId", "type", "status");

-- CreateIndex
CREATE INDEX "SubledgerAccount_tenantId_controlAccountId_idx" ON "accounting"."SubledgerAccount"("tenantId", "controlAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "SubledgerAccount_id_tenantId_key" ON "accounting"."SubledgerAccount"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SubledgerAccount_tenantId_code_key" ON "accounting"."SubledgerAccount"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SubledgerAccount_tenantId_type_externalRef_key" ON "accounting"."SubledgerAccount"("tenantId", "type", "externalRef");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_status_transactionDate_idx" ON "accounting"."JournalEntry"("tenantId", "status", "transactionDate");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_fiscalPeriodId_status_idx" ON "accounting"."JournalEntry"("tenantId", "fiscalPeriodId", "status");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_sourceModule_sourceRecordType_sourceR_idx" ON "accounting"."JournalEntry"("tenantId", "sourceModule", "sourceRecordType", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_id_tenantId_key" ON "accounting"."JournalEntry"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_journalNumber_key" ON "accounting"."JournalEntry"("tenantId", "journalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_idempotencyKey_key" ON "accounting"."JournalEntry"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversalOfJournalId_tenantId_key" ON "accounting"."JournalEntry"("reversalOfJournalId", "tenantId");

-- CreateIndex
CREATE INDEX "JournalLine_tenantId_glAccountId_journalEntryId_idx" ON "accounting"."JournalLine"("tenantId", "glAccountId", "journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_tenantId_subledgerAccountId_idx" ON "accounting"."JournalLine"("tenantId", "subledgerAccountId");

-- CreateIndex
CREATE INDEX "JournalLine_tenantId_costCentreId_idx" ON "accounting"."JournalLine"("tenantId", "costCentreId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_id_tenantId_key" ON "accounting"."JournalLine"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_tenantId_journalEntryId_lineNumber_key" ON "accounting"."JournalLine"("tenantId", "journalEntryId", "lineNumber");

-- AddForeignKey
ALTER TABLE "accounting"."GLAccount" ADD CONSTRAINT "GLAccount_parentAccountId_tenantId_fkey" FOREIGN KEY ("parentAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."SubledgerAccount" ADD CONSTRAINT "SubledgerAccount_controlAccountId_tenantId_fkey" FOREIGN KEY ("controlAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalPeriodId_tenantId_fkey" FOREIGN KEY ("fiscalPeriodId", "tenantId") REFERENCES "accounting"."FiscalPeriod"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfJournalId_tenantId_fkey" FOREIGN KEY ("reversalOfJournalId", "tenantId") REFERENCES "accounting"."JournalEntry"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_tenantId_fkey" FOREIGN KEY ("journalEntryId", "tenantId") REFERENCES "accounting"."JournalEntry"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."JournalLine" ADD CONSTRAINT "JournalLine_glAccountId_tenantId_fkey" FOREIGN KEY ("glAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."JournalLine" ADD CONSTRAINT "JournalLine_subledgerAccountId_tenantId_fkey" FOREIGN KEY ("subledgerAccountId", "tenantId") REFERENCES "accounting"."SubledgerAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."JournalLine" ADD CONSTRAINT "JournalLine_costCentreId_tenantId_fkey" FOREIGN KEY ("costCentreId", "tenantId") REFERENCES "accounting"."CostCentre"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ledger invariants are enforced in both the service and database.
ALTER TABLE "accounting"."AccountingTenantConfig"
  ADD CONSTRAINT "AccountingTenantConfig_fiscalYearStartMonth_check"
  CHECK ("fiscalYearStartMonth" BETWEEN 1 AND 12),
  ADD CONSTRAINT "AccountingTenantConfig_decimalPlaces_check"
  CHECK ("decimalPlaces" BETWEEN 0 AND 4);

ALTER TABLE "accounting"."AccountingCurrency"
  ADD CONSTRAINT "AccountingCurrency_decimalPlaces_check"
  CHECK ("decimalPlaces" BETWEEN 0 AND 4);

ALTER TABLE "accounting"."ExchangeRate"
  ADD CONSTRAINT "ExchangeRate_positive_rate_check"
  CHECK ("rate" > 0),
  ADD CONSTRAINT "ExchangeRate_distinct_currencies_check"
  CHECK ("fromCurrency" <> "toCurrency");

ALTER TABLE "accounting"."FiscalPeriod"
  ADD CONSTRAINT "FiscalPeriod_date_order_check"
  CHECK ("startDate" <= "endDate");

ALTER TABLE "accounting"."JournalEntry"
  ADD CONSTRAINT "JournalEntry_positive_exchange_rate_check"
  CHECK ("exchangeRate" > 0);

ALTER TABLE "accounting"."JournalLine"
  ADD CONSTRAINT "JournalLine_non_negative_amounts_check"
  CHECK (
    "transactionDebit" >= 0 AND
    "transactionCredit" >= 0 AND
    "baseDebit" >= 0 AND
    "baseCredit" >= 0
  ),
  ADD CONSTRAINT "JournalLine_single_sided_amount_check"
  CHECK (
    ("transactionDebit" > 0 AND "transactionCredit" = 0) OR
    ("transactionCredit" > 0 AND "transactionDebit" = 0)
  ),
  ADD CONSTRAINT "JournalLine_base_amount_alignment_check"
  CHECK (
    ("transactionDebit" > 0 AND "baseDebit" > 0 AND "baseCredit" = 0) OR
    ("transactionCredit" > 0 AND "baseCredit" > 0 AND "baseDebit" = 0)
  );
