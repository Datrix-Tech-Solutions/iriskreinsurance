-- Add current-effective debit-note statement support.
--
-- Existing placement and endorsement notes remain valid. Current effective
-- debit notes are persisted for traceability/versioning but are non-posting
-- statements by default to avoid duplicating receivables already recognised by
-- original and endorsement debit notes.

ALTER TYPE reinsurance."PlacementNoteType"
  ADD VALUE IF NOT EXISTS 'CURRENT_EFFECTIVE_DEBIT_NOTE';

ALTER TABLE reinsurance."PlacementNote"
  ADD COLUMN "sourceSnapshot" JSONB,
  ADD COLUMN "effectiveAsOf" TIMESTAMP(3),
  ADD COLUMN "effectiveVersionKey" TEXT,
  ADD COLUMN "postingEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "PlacementNote_tenantId_placementId_type_effectiveAsOf_idx"
  ON reinsurance."PlacementNote"("tenantId", "placementId", "type", "effectiveAsOf");

CREATE UNIQUE INDEX "PlacementNote_tenantId_placementId_type_effectiveVersionKey_key"
  ON reinsurance."PlacementNote"("tenantId", "placementId", "type", "effectiveVersionKey");
