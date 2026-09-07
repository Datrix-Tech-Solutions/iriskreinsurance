-- CreateEnum
CREATE TYPE "accounting"."PostingDirection" AS ENUM ('DR', 'CR');

-- CreateEnum
CREATE TYPE "accounting"."SourceEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'POSTED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "accounting"."PostingRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceEventType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."PostingRuleLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "postingRuleId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "direction" "accounting"."PostingDirection" NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "subledgerType" "accounting"."SubledgerType",
    "subledgerExternalRefSource" TEXT,
    "amountSource" TEXT NOT NULL,
    "currencySource" TEXT NOT NULL,
    "descriptionTemplate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostingRuleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."SourceEventInbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceEventType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "accounting"."SourceEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "failureReason" TEXT,
    "postingRuleId" TEXT,
    "journalEntryId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "receivedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "SourceEventInbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostingRule_id_tenantId_key" ON "accounting"."PostingRule"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PostingRule_tenantId_sourceModule_sourceEventType_version_key" ON "accounting"."PostingRule"("tenantId", "sourceModule", "sourceEventType", "version");

-- CreateIndex
CREATE INDEX "PostingRule_tenantId_sourceModule_sourceEventType_active_ef_idx" ON "accounting"."PostingRule"("tenantId", "sourceModule", "sourceEventType", "active", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "PostingRuleLine_id_tenantId_key" ON "accounting"."PostingRuleLine"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PostingRuleLine_tenantId_postingRuleId_sequence_key" ON "accounting"."PostingRuleLine"("tenantId", "postingRuleId", "sequence");

-- CreateIndex
CREATE INDEX "PostingRuleLine_tenantId_glAccountId_idx" ON "accounting"."PostingRuleLine"("tenantId", "glAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceEventInbox_id_tenantId_key" ON "accounting"."SourceEventInbox"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceEventInbox_tenantId_idempotencyKey_key" ON "accounting"."SourceEventInbox"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SourceEventInbox_journalEntryId_tenantId_key" ON "accounting"."SourceEventInbox"("journalEntryId", "tenantId");

-- CreateIndex
CREATE INDEX "SourceEventInbox_tenantId_status_createdAt_idx" ON "accounting"."SourceEventInbox"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SourceEventInbox_tenantId_sourceModule_sourceEventType_sour_idx" ON "accounting"."SourceEventInbox"("tenantId", "sourceModule", "sourceEventType", "sourceRecordId");

-- CreateIndex
CREATE INDEX "SourceEventInbox_tenantId_postingRuleId_idx" ON "accounting"."SourceEventInbox"("tenantId", "postingRuleId");

-- AddForeignKey
ALTER TABLE "accounting"."PostingRuleLine" ADD CONSTRAINT "PostingRuleLine_postingRuleId_tenantId_fkey" FOREIGN KEY ("postingRuleId", "tenantId") REFERENCES "accounting"."PostingRule"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."PostingRuleLine" ADD CONSTRAINT "PostingRuleLine_glAccountId_tenantId_fkey" FOREIGN KEY ("glAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."SourceEventInbox" ADD CONSTRAINT "SourceEventInbox_postingRuleId_tenantId_fkey" FOREIGN KEY ("postingRuleId", "tenantId") REFERENCES "accounting"."PostingRule"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."SourceEventInbox" ADD CONSTRAINT "SourceEventInbox_journalEntryId_tenantId_fkey" FOREIGN KEY ("journalEntryId", "tenantId") REFERENCES "accounting"."JournalEntry"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
