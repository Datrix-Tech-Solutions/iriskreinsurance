-- Link Accounting source-event cash movements to Cashbook without changing
-- historical source events or existing standalone Cashbook rows.
ALTER TABLE "accounting"."CashbookTransaction"
  ADD COLUMN "sourceEventInboxId" TEXT,
  ADD COLUMN "sourceEventType" TEXT,
  ADD COLUMN "sourceReference" TEXT;

CREATE UNIQUE INDEX "CashbookTransaction_sourceEventInboxId_tenantId_key"
  ON "accounting"."CashbookTransaction"("sourceEventInboxId", "tenantId");

CREATE INDEX "CashbookTransaction_tenantId_sourceModule_sourceEventType_sourceRecordId_idx"
  ON "accounting"."CashbookTransaction"("tenantId", "sourceModule", "sourceEventType", "sourceRecordId");

ALTER TABLE "accounting"."CashbookTransaction"
  ADD CONSTRAINT "CashbookTransaction_sourceEventInboxId_tenantId_fkey"
  FOREIGN KEY ("sourceEventInboxId", "tenantId")
  REFERENCES "accounting"."SourceEventInbox"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
