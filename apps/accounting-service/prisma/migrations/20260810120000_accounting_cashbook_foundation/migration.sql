CREATE TYPE "accounting"."AccountingCashAccountKind" AS ENUM (
  'BANK',
  'CASH',
  'MOBILE_MONEY',
  'OTHER'
);

CREATE TYPE "accounting"."CashbookTransactionType" AS ENUM (
  'RECEIPT',
  'PAYMENT',
  'TRANSFER',
  'CHARGE',
  'ADJUSTMENT'
);

CREATE TYPE "accounting"."CashbookDirection" AS ENUM (
  'INFLOW',
  'OUTFLOW',
  'TRANSFER'
);

CREATE TYPE "accounting"."AccountingSettlementMethod" AS ENUM (
  'BANK_TRANSFER',
  'CHEQUE',
  'CASH',
  'MOBILE_MONEY',
  'INTERNAL_TRANSFER',
  'JOURNAL',
  'OTHER'
);

CREATE TYPE "accounting"."CashbookTransactionStatus" AS ENUM (
  'DRAFT',
  'POSTED',
  'REVERSED'
);

CREATE TABLE "accounting"."AccountingCashAccount" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "accountKind" "accounting"."AccountingCashAccountKind" NOT NULL,
  "currency" TEXT NOT NULL,
  "glAccountId" TEXT NOT NULL,
  "bankName" TEXT,
  "accountNumber" TEXT,
  "branch" TEXT,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountingCashAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting"."CashbookTransaction" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cashAccountId" TEXT NOT NULL,
  "destinationCashAccountId" TEXT,
  "transactionType" "accounting"."CashbookTransactionType" NOT NULL,
  "direction" "accounting"."CashbookDirection" NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "settlementMethod" "accounting"."AccountingSettlementMethod" NOT NULL,
  "reference" TEXT,
  "counterpartyType" TEXT,
  "counterpartyId" TEXT,
  "externalReference" TEXT,
  "description" TEXT NOT NULL,
  "offsetGlAccountId" TEXT,
  "sourceModule" TEXT,
  "sourceRecordId" TEXT,
  "exchangeRate" DECIMAL(18,8),
  "status" "accounting"."CashbookTransactionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "postedByUserId" TEXT,
  "reversedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "postedAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "postedJournalEntryId" TEXT,
  "reversalJournalEntryId" TEXT,
  "reversalOfTransactionId" TEXT,

  CONSTRAINT "CashbookTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingCashAccount_id_tenantId_key"
  ON "accounting"."AccountingCashAccount"("id", "tenantId");
CREATE UNIQUE INDEX "AccountingCashAccount_tenantId_name_key"
  ON "accounting"."AccountingCashAccount"("tenantId", "name");
CREATE UNIQUE INDEX "AccountingCashAccount_tenantId_accountKind_currency_accountNumber_key"
  ON "accounting"."AccountingCashAccount"("tenantId", "accountKind", "currency", "accountNumber");
CREATE INDEX "AccountingCashAccount_tenantId_accountKind_isActive_idx"
  ON "accounting"."AccountingCashAccount"("tenantId", "accountKind", "isActive");
CREATE INDEX "AccountingCashAccount_tenantId_currency_isActive_idx"
  ON "accounting"."AccountingCashAccount"("tenantId", "currency", "isActive");
CREATE INDEX "AccountingCashAccount_tenantId_glAccountId_idx"
  ON "accounting"."AccountingCashAccount"("tenantId", "glAccountId");

CREATE UNIQUE INDEX "CashbookTransaction_id_tenantId_key"
  ON "accounting"."CashbookTransaction"("id", "tenantId");
CREATE UNIQUE INDEX "CashbookTransaction_postedJournalEntryId_tenantId_key"
  ON "accounting"."CashbookTransaction"("postedJournalEntryId", "tenantId");
CREATE UNIQUE INDEX "CashbookTransaction_reversalJournalEntryId_tenantId_key"
  ON "accounting"."CashbookTransaction"("reversalJournalEntryId", "tenantId");
CREATE UNIQUE INDEX "CashbookTransaction_reversalOfTransactionId_tenantId_key"
  ON "accounting"."CashbookTransaction"("reversalOfTransactionId", "tenantId");
CREATE INDEX "CashbookTransaction_tenantId_cashAccountId_transactionDate_idx"
  ON "accounting"."CashbookTransaction"("tenantId", "cashAccountId", "transactionDate");
CREATE INDEX "CashbookTransaction_tenantId_destinationCashAccountId_idx"
  ON "accounting"."CashbookTransaction"("tenantId", "destinationCashAccountId");
CREATE INDEX "CashbookTransaction_tenantId_transactionType_status_transactionDate_idx"
  ON "accounting"."CashbookTransaction"("tenantId", "transactionType", "status", "transactionDate");
CREATE INDEX "CashbookTransaction_tenantId_currency_transactionDate_idx"
  ON "accounting"."CashbookTransaction"("tenantId", "currency", "transactionDate");
CREATE INDEX "CashbookTransaction_tenantId_sourceModule_sourceRecordId_idx"
  ON "accounting"."CashbookTransaction"("tenantId", "sourceModule", "sourceRecordId");

ALTER TABLE "accounting"."AccountingCashAccount"
  ADD CONSTRAINT "AccountingCashAccount_glAccountId_tenantId_fkey"
  FOREIGN KEY ("glAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."CashbookTransaction"
  ADD CONSTRAINT "CashbookTransaction_cashAccountId_tenantId_fkey"
  FOREIGN KEY ("cashAccountId", "tenantId")
  REFERENCES "accounting"."AccountingCashAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."CashbookTransaction"
  ADD CONSTRAINT "CashbookTransaction_destinationCashAccountId_tenantId_fkey"
  FOREIGN KEY ("destinationCashAccountId", "tenantId")
  REFERENCES "accounting"."AccountingCashAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."CashbookTransaction"
  ADD CONSTRAINT "CashbookTransaction_offsetGlAccountId_tenantId_fkey"
  FOREIGN KEY ("offsetGlAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."CashbookTransaction"
  ADD CONSTRAINT "CashbookTransaction_postedJournalEntryId_tenantId_fkey"
  FOREIGN KEY ("postedJournalEntryId", "tenantId")
  REFERENCES "accounting"."JournalEntry"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."CashbookTransaction"
  ADD CONSTRAINT "CashbookTransaction_reversalJournalEntryId_tenantId_fkey"
  FOREIGN KEY ("reversalJournalEntryId", "tenantId")
  REFERENCES "accounting"."JournalEntry"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."CashbookTransaction"
  ADD CONSTRAINT "CashbookTransaction_reversalOfTransactionId_tenantId_fkey"
  FOREIGN KEY ("reversalOfTransactionId", "tenantId")
  REFERENCES "accounting"."CashbookTransaction"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
