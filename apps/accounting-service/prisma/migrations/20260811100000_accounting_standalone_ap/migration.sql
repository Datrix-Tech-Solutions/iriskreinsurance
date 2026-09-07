CREATE TYPE "accounting"."AccountingPayableDocumentType" AS ENUM (
  'BILL',
  'CREDIT_NOTE'
);

CREATE TYPE "accounting"."AccountingPayableStatus" AS ENUM (
  'DRAFT',
  'POSTED',
  'REVERSED'
);

CREATE TYPE "accounting"."AccountingPayableAllocationSource" AS ENUM (
  'PAYMENT',
  'CREDIT_NOTE'
);

CREATE TABLE "accounting"."AccountingPayableDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "documentType" "accounting"."AccountingPayableDocumentType" NOT NULL,
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
  "originalBillId" TEXT,
  "status" "accounting"."AccountingPayableStatus" NOT NULL DEFAULT 'DRAFT',
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

  CONSTRAINT "AccountingPayableDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting"."AccountingPayablePayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "cashbookTransactionId" TEXT NOT NULL,
  "paymentNumber" TEXT NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "exchangeRate" DECIMAL(18,8),
  "reference" TEXT,
  "description" TEXT,
  "externalReference" TEXT,
  "sourceModule" TEXT,
  "sourceRecordId" TEXT,
  "status" "accounting"."AccountingPayableStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "postedByUserId" TEXT,
  "reversedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "postedAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "reversalOfPaymentId" TEXT,

  CONSTRAINT "AccountingPayablePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting"."AccountingPayableAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "paymentId" TEXT,
  "creditNoteId" TEXT,
  "sourceType" "accounting"."AccountingPayableAllocationSource" NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT NOT NULL,
  "reversedAt" TIMESTAMP(3),
  "reversedByUserId" TEXT,
  "reversalReason" TEXT,

  CONSTRAINT "AccountingPayableAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingPayableDocument_id_tenantId_key"
  ON "accounting"."AccountingPayableDocument"("id", "tenantId");
CREATE UNIQUE INDEX "AccountingPayableDocument_tenantId_documentNumber_key"
  ON "accounting"."AccountingPayableDocument"("tenantId", "documentNumber");
CREATE UNIQUE INDEX "AccountingPayableDocument_postedJournalEntryId_tenantId_key"
  ON "accounting"."AccountingPayableDocument"("postedJournalEntryId", "tenantId");
CREATE UNIQUE INDEX "AccountingPayableDocument_reversalJournalEntryId_tenantId_key"
  ON "accounting"."AccountingPayableDocument"("reversalJournalEntryId", "tenantId");
CREATE UNIQUE INDEX "AccountingPayableDocument_reversalOfDocumentId_tenantId_key"
  ON "accounting"."AccountingPayableDocument"("reversalOfDocumentId", "tenantId");
CREATE INDEX "AccountingPayableDocument_tenantId_vendorId_documentType_status_idx"
  ON "accounting"."AccountingPayableDocument"("tenantId", "vendorId", "documentType", "status");
CREATE INDEX "AccountingPayableDocument_tenantId_documentDate_idx"
  ON "accounting"."AccountingPayableDocument"("tenantId", "documentDate");
CREATE INDEX "AccountingPayableDocument_tenantId_dueDate_idx"
  ON "accounting"."AccountingPayableDocument"("tenantId", "dueDate");
CREATE INDEX "AccountingPayableDocument_tenantId_currency_idx"
  ON "accounting"."AccountingPayableDocument"("tenantId", "currency");
CREATE INDEX "AccountingPayableDocument_tenantId_sourceModule_sourceRecordId_idx"
  ON "accounting"."AccountingPayableDocument"("tenantId", "sourceModule", "sourceRecordId");
CREATE INDEX "AccountingPayableDocument_tenantId_originalBillId_idx"
  ON "accounting"."AccountingPayableDocument"("tenantId", "originalBillId");

CREATE UNIQUE INDEX "AccountingPayablePayment_id_tenantId_key"
  ON "accounting"."AccountingPayablePayment"("id", "tenantId");
CREATE UNIQUE INDEX "AccountingPayablePayment_tenantId_paymentNumber_key"
  ON "accounting"."AccountingPayablePayment"("tenantId", "paymentNumber");
CREATE UNIQUE INDEX "AccountingPayablePayment_cashbookTransactionId_tenantId_key"
  ON "accounting"."AccountingPayablePayment"("cashbookTransactionId", "tenantId");
CREATE UNIQUE INDEX "AccountingPayablePayment_reversalOfPaymentId_tenantId_key"
  ON "accounting"."AccountingPayablePayment"("reversalOfPaymentId", "tenantId");
CREATE INDEX "AccountingPayablePayment_tenantId_vendorId_status_idx"
  ON "accounting"."AccountingPayablePayment"("tenantId", "vendorId", "status");
CREATE INDEX "AccountingPayablePayment_tenantId_paymentDate_idx"
  ON "accounting"."AccountingPayablePayment"("tenantId", "paymentDate");
CREATE INDEX "AccountingPayablePayment_tenantId_currency_idx"
  ON "accounting"."AccountingPayablePayment"("tenantId", "currency");
CREATE INDEX "AccountingPayablePayment_tenantId_sourceModule_sourceRecordId_idx"
  ON "accounting"."AccountingPayablePayment"("tenantId", "sourceModule", "sourceRecordId");

CREATE UNIQUE INDEX "AccountingPayableAllocation_id_tenantId_key"
  ON "accounting"."AccountingPayableAllocation"("id", "tenantId");
CREATE INDEX "AccountingPayableAllocation_tenantId_vendorId_allocatedAt_idx"
  ON "accounting"."AccountingPayableAllocation"("tenantId", "vendorId", "allocatedAt");
CREATE INDEX "AccountingPayableAllocation_tenantId_billId_idx"
  ON "accounting"."AccountingPayableAllocation"("tenantId", "billId");
CREATE INDEX "AccountingPayableAllocation_tenantId_paymentId_idx"
  ON "accounting"."AccountingPayableAllocation"("tenantId", "paymentId");
CREATE INDEX "AccountingPayableAllocation_tenantId_creditNoteId_idx"
  ON "accounting"."AccountingPayableAllocation"("tenantId", "creditNoteId");
CREATE INDEX "AccountingPayableAllocation_tenantId_sourceType_idx"
  ON "accounting"."AccountingPayableAllocation"("tenantId", "sourceType");

ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD CONSTRAINT "AccountingPayableDocument_vendorId_tenantId_fkey"
  FOREIGN KEY ("vendorId", "tenantId")
  REFERENCES "accounting"."AccountingVendor"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD CONSTRAINT "AccountingPayableDocument_offsetGlAccountId_tenantId_fkey"
  FOREIGN KEY ("offsetGlAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD CONSTRAINT "AccountingPayableDocument_postedJournalEntryId_tenantId_fkey"
  FOREIGN KEY ("postedJournalEntryId", "tenantId")
  REFERENCES "accounting"."JournalEntry"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD CONSTRAINT "AccountingPayableDocument_reversalJournalEntryId_tenantId_fkey"
  FOREIGN KEY ("reversalJournalEntryId", "tenantId")
  REFERENCES "accounting"."JournalEntry"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD CONSTRAINT "AccountingPayableDocument_originalBillId_tenantId_fkey"
  FOREIGN KEY ("originalBillId", "tenantId")
  REFERENCES "accounting"."AccountingPayableDocument"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD CONSTRAINT "AccountingPayableDocument_reversalOfDocumentId_tenantId_fkey"
  FOREIGN KEY ("reversalOfDocumentId", "tenantId")
  REFERENCES "accounting"."AccountingPayableDocument"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayablePayment"
  ADD CONSTRAINT "AccountingPayablePayment_vendorId_tenantId_fkey"
  FOREIGN KEY ("vendorId", "tenantId")
  REFERENCES "accounting"."AccountingVendor"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayablePayment"
  ADD CONSTRAINT "AccountingPayablePayment_cashbookTransactionId_tenantId_fkey"
  FOREIGN KEY ("cashbookTransactionId", "tenantId")
  REFERENCES "accounting"."CashbookTransaction"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayablePayment"
  ADD CONSTRAINT "AccountingPayablePayment_reversalOfPaymentId_tenantId_fkey"
  FOREIGN KEY ("reversalOfPaymentId", "tenantId")
  REFERENCES "accounting"."AccountingPayablePayment"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableAllocation"
  ADD CONSTRAINT "AccountingPayableAllocation_vendorId_tenantId_fkey"
  FOREIGN KEY ("vendorId", "tenantId")
  REFERENCES "accounting"."AccountingVendor"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableAllocation"
  ADD CONSTRAINT "AccountingPayableAllocation_billId_tenantId_fkey"
  FOREIGN KEY ("billId", "tenantId")
  REFERENCES "accounting"."AccountingPayableDocument"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableAllocation"
  ADD CONSTRAINT "AccountingPayableAllocation_paymentId_tenantId_fkey"
  FOREIGN KEY ("paymentId", "tenantId")
  REFERENCES "accounting"."AccountingPayablePayment"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableAllocation"
  ADD CONSTRAINT "AccountingPayableAllocation_creditNoteId_tenantId_fkey"
  FOREIGN KEY ("creditNoteId", "tenantId")
  REFERENCES "accounting"."AccountingPayableDocument"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
