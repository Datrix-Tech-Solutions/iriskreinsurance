CREATE TYPE "accounting"."AccountingReceivableDocumentType" AS ENUM (
  'INVOICE',
  'CREDIT_NOTE'
);

CREATE TYPE "accounting"."AccountingReceivableStatus" AS ENUM (
  'DRAFT',
  'POSTED',
  'REVERSED'
);

CREATE TYPE "accounting"."AccountingReceivableAllocationSource" AS ENUM (
  'RECEIPT',
  'CREDIT_NOTE'
);

ALTER TABLE "accounting"."CashbookTransaction"
  ADD COLUMN "offsetSubledgerAccountId" TEXT;

CREATE TABLE "accounting"."AccountingReceivableDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "documentType" "accounting"."AccountingReceivableDocumentType" NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "documentDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "currency" TEXT NOT NULL,
  "exchangeRate" DECIMAL(18,8),
  "subtotalAmount" DECIMAL(20,4) NOT NULL,
  "taxAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(20,4) NOT NULL,
  "description" TEXT,
  "externalReference" TEXT,
  "sourceModule" TEXT,
  "sourceRecordId" TEXT,
  "offsetGlAccountId" TEXT NOT NULL,
  "originalInvoiceId" TEXT,
  "status" "accounting"."AccountingReceivableStatus" NOT NULL DEFAULT 'DRAFT',
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
  "reversalOfDocumentId" TEXT,

  CONSTRAINT "AccountingReceivableDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting"."AccountingReceivableReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "cashbookTransactionId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "receiptDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "exchangeRate" DECIMAL(18,8),
  "reference" TEXT,
  "description" TEXT,
  "externalReference" TEXT,
  "sourceModule" TEXT,
  "sourceRecordId" TEXT,
  "status" "accounting"."AccountingReceivableStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "postedByUserId" TEXT,
  "reversedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "postedAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "reversalOfReceiptId" TEXT,

  CONSTRAINT "AccountingReceivableReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting"."AccountingReceivableAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "receiptId" TEXT,
  "creditNoteId" TEXT,
  "sourceType" "accounting"."AccountingReceivableAllocationSource" NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT NOT NULL,
  "reversedAt" TIMESTAMP(3),
  "reversedByUserId" TEXT,
  "reversalReason" TEXT,

  CONSTRAINT "AccountingReceivableAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashbookTransaction_tenantId_offsetSubledgerAccountId_idx"
  ON "accounting"."CashbookTransaction"("tenantId", "offsetSubledgerAccountId");

CREATE UNIQUE INDEX "AccountingReceivableDocument_id_tenantId_key"
  ON "accounting"."AccountingReceivableDocument"("id", "tenantId");
CREATE UNIQUE INDEX "AccountingReceivableDocument_tenantId_documentNumber_key"
  ON "accounting"."AccountingReceivableDocument"("tenantId", "documentNumber");
CREATE UNIQUE INDEX "AccountingReceivableDocument_postedJournalEntryId_tenantId_key"
  ON "accounting"."AccountingReceivableDocument"("postedJournalEntryId", "tenantId");
CREATE UNIQUE INDEX "AccountingReceivableDocument_reversalJournalEntryId_tenantId_key"
  ON "accounting"."AccountingReceivableDocument"("reversalJournalEntryId", "tenantId");
CREATE UNIQUE INDEX "AccountingReceivableDocument_reversalOfDocumentId_tenantId_key"
  ON "accounting"."AccountingReceivableDocument"("reversalOfDocumentId", "tenantId");
CREATE INDEX "AccountingReceivableDocument_tenantId_customerId_documentType_status_idx"
  ON "accounting"."AccountingReceivableDocument"("tenantId", "customerId", "documentType", "status");
CREATE INDEX "AccountingReceivableDocument_tenantId_documentDate_idx"
  ON "accounting"."AccountingReceivableDocument"("tenantId", "documentDate");
CREATE INDEX "AccountingReceivableDocument_tenantId_dueDate_idx"
  ON "accounting"."AccountingReceivableDocument"("tenantId", "dueDate");
CREATE INDEX "AccountingReceivableDocument_tenantId_currency_idx"
  ON "accounting"."AccountingReceivableDocument"("tenantId", "currency");
CREATE INDEX "AccountingReceivableDocument_tenantId_sourceModule_sourceRecordId_idx"
  ON "accounting"."AccountingReceivableDocument"("tenantId", "sourceModule", "sourceRecordId");
CREATE INDEX "AccountingReceivableDocument_tenantId_originalInvoiceId_idx"
  ON "accounting"."AccountingReceivableDocument"("tenantId", "originalInvoiceId");

CREATE UNIQUE INDEX "AccountingReceivableReceipt_id_tenantId_key"
  ON "accounting"."AccountingReceivableReceipt"("id", "tenantId");
CREATE UNIQUE INDEX "AccountingReceivableReceipt_tenantId_receiptNumber_key"
  ON "accounting"."AccountingReceivableReceipt"("tenantId", "receiptNumber");
CREATE UNIQUE INDEX "AccountingReceivableReceipt_cashbookTransactionId_tenantId_key"
  ON "accounting"."AccountingReceivableReceipt"("cashbookTransactionId", "tenantId");
CREATE UNIQUE INDEX "AccountingReceivableReceipt_reversalOfReceiptId_tenantId_key"
  ON "accounting"."AccountingReceivableReceipt"("reversalOfReceiptId", "tenantId");
CREATE INDEX "AccountingReceivableReceipt_tenantId_customerId_status_idx"
  ON "accounting"."AccountingReceivableReceipt"("tenantId", "customerId", "status");
CREATE INDEX "AccountingReceivableReceipt_tenantId_receiptDate_idx"
  ON "accounting"."AccountingReceivableReceipt"("tenantId", "receiptDate");
CREATE INDEX "AccountingReceivableReceipt_tenantId_currency_idx"
  ON "accounting"."AccountingReceivableReceipt"("tenantId", "currency");
CREATE INDEX "AccountingReceivableReceipt_tenantId_sourceModule_sourceRecordId_idx"
  ON "accounting"."AccountingReceivableReceipt"("tenantId", "sourceModule", "sourceRecordId");

CREATE UNIQUE INDEX "AccountingReceivableAllocation_id_tenantId_key"
  ON "accounting"."AccountingReceivableAllocation"("id", "tenantId");
CREATE INDEX "AccountingReceivableAllocation_tenantId_customerId_allocatedAt_idx"
  ON "accounting"."AccountingReceivableAllocation"("tenantId", "customerId", "allocatedAt");
CREATE INDEX "AccountingReceivableAllocation_tenantId_invoiceId_idx"
  ON "accounting"."AccountingReceivableAllocation"("tenantId", "invoiceId");
CREATE INDEX "AccountingReceivableAllocation_tenantId_receiptId_idx"
  ON "accounting"."AccountingReceivableAllocation"("tenantId", "receiptId");
CREATE INDEX "AccountingReceivableAllocation_tenantId_creditNoteId_idx"
  ON "accounting"."AccountingReceivableAllocation"("tenantId", "creditNoteId");
CREATE INDEX "AccountingReceivableAllocation_tenantId_sourceType_idx"
  ON "accounting"."AccountingReceivableAllocation"("tenantId", "sourceType");

ALTER TABLE "accounting"."CashbookTransaction"
  ADD CONSTRAINT "CashbookTransaction_offsetSubledgerAccountId_tenantId_fkey"
  FOREIGN KEY ("offsetSubledgerAccountId", "tenantId")
  REFERENCES "accounting"."SubledgerAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD CONSTRAINT "AccountingReceivableDocument_customerId_tenantId_fkey"
  FOREIGN KEY ("customerId", "tenantId")
  REFERENCES "accounting"."AccountingCustomer"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD CONSTRAINT "AccountingReceivableDocument_offsetGlAccountId_tenantId_fkey"
  FOREIGN KEY ("offsetGlAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD CONSTRAINT "AccountingReceivableDocument_postedJournalEntryId_tenantId_fkey"
  FOREIGN KEY ("postedJournalEntryId", "tenantId")
  REFERENCES "accounting"."JournalEntry"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD CONSTRAINT "AccountingReceivableDocument_reversalJournalEntryId_tenantId_fkey"
  FOREIGN KEY ("reversalJournalEntryId", "tenantId")
  REFERENCES "accounting"."JournalEntry"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD CONSTRAINT "AccountingReceivableDocument_originalInvoiceId_tenantId_fkey"
  FOREIGN KEY ("originalInvoiceId", "tenantId")
  REFERENCES "accounting"."AccountingReceivableDocument"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD CONSTRAINT "AccountingReceivableDocument_reversalOfDocumentId_tenantId_fkey"
  FOREIGN KEY ("reversalOfDocumentId", "tenantId")
  REFERENCES "accounting"."AccountingReceivableDocument"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableReceipt"
  ADD CONSTRAINT "AccountingReceivableReceipt_customerId_tenantId_fkey"
  FOREIGN KEY ("customerId", "tenantId")
  REFERENCES "accounting"."AccountingCustomer"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableReceipt"
  ADD CONSTRAINT "AccountingReceivableReceipt_cashbookTransactionId_tenantId_fkey"
  FOREIGN KEY ("cashbookTransactionId", "tenantId")
  REFERENCES "accounting"."CashbookTransaction"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableReceipt"
  ADD CONSTRAINT "AccountingReceivableReceipt_reversalOfReceiptId_tenantId_fkey"
  FOREIGN KEY ("reversalOfReceiptId", "tenantId")
  REFERENCES "accounting"."AccountingReceivableReceipt"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableAllocation"
  ADD CONSTRAINT "AccountingReceivableAllocation_customerId_tenantId_fkey"
  FOREIGN KEY ("customerId", "tenantId")
  REFERENCES "accounting"."AccountingCustomer"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableAllocation"
  ADD CONSTRAINT "AccountingReceivableAllocation_invoiceId_tenantId_fkey"
  FOREIGN KEY ("invoiceId", "tenantId")
  REFERENCES "accounting"."AccountingReceivableDocument"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableAllocation"
  ADD CONSTRAINT "AccountingReceivableAllocation_receiptId_tenantId_fkey"
  FOREIGN KEY ("receiptId", "tenantId")
  REFERENCES "accounting"."AccountingReceivableReceipt"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableAllocation"
  ADD CONSTRAINT "AccountingReceivableAllocation_creditNoteId_tenantId_fkey"
  FOREIGN KEY ("creditNoteId", "tenantId")
  REFERENCES "accounting"."AccountingReceivableDocument"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
