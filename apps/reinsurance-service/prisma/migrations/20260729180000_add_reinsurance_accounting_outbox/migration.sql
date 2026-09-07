CREATE TYPE "reinsurance"."ReinsuranceAccountingOutboxStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'DELIVERED',
  'FAILED'
);

CREATE TABLE "reinsurance"."ReinsuranceAccountingOutbox" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sourceEventType" TEXT NOT NULL,
  "sourceRecordType" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "sourceDocumentId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "reinsurance"."ReinsuranceAccountingOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "accountingSourceEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deliveredAt" TIMESTAMP(3),

  CONSTRAINT "ReinsuranceAccountingOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReinsuranceAccountingOutbox_id_tenantId_key"
  ON "reinsurance"."ReinsuranceAccountingOutbox"("id", "tenantId");

CREATE UNIQUE INDEX "ReinsuranceAccountingOutbox_tenantId_idempotencyKey_key"
  ON "reinsurance"."ReinsuranceAccountingOutbox"("tenantId", "idempotencyKey");

CREATE INDEX "ReinsuranceAccountingOutbox_tenantId_status_nextAttemptAt_createdAt_idx"
  ON "reinsurance"."ReinsuranceAccountingOutbox"("tenantId", "status", "nextAttemptAt", "createdAt");

CREATE INDEX "ReinsuranceAccountingOutbox_tenantId_sourceRecordType_sourceRecordId_idx"
  ON "reinsurance"."ReinsuranceAccountingOutbox"("tenantId", "sourceRecordType", "sourceRecordId");

CREATE INDEX "ReinsuranceAccountingOutbox_tenantId_sourceEventType_createdAt_idx"
  ON "reinsurance"."ReinsuranceAccountingOutbox"("tenantId", "sourceEventType", "createdAt");
