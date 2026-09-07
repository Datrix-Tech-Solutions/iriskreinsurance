-- Add endorsement note links and explicit endorsement note types.
--
-- Endorsement notes reuse PlacementNote while linking to immutable
-- PlacementEndorsementClosing snapshots. Existing placement notes remain valid
-- with these nullable columns empty.

ALTER TYPE reinsurance."PlacementNoteType"
  ADD VALUE IF NOT EXISTS 'ENDORSEMENT_DEBIT_NOTE';

ALTER TYPE reinsurance."PlacementNoteType"
  ADD VALUE IF NOT EXISTS 'ENDORSEMENT_CREDIT_NOTE';

ALTER TABLE reinsurance."PlacementNote"
  ADD COLUMN "endorsementId" TEXT,
  ADD COLUMN "endorsementClosingId" TEXT,
  ADD COLUMN "endorsementParticipantId" TEXT;

ALTER TABLE reinsurance."PlacementNote"
  ADD CONSTRAINT "PlacementNote_endorsementId_tenantId_fkey"
  FOREIGN KEY ("endorsementId", "tenantId")
  REFERENCES reinsurance."PlacementEndorsement"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementNote"
  ADD CONSTRAINT "PlacementNote_endorsementClosingId_tenantId_fkey"
  FOREIGN KEY ("endorsementClosingId", "tenantId")
  REFERENCES reinsurance."PlacementEndorsementClosing"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementNote"
  ADD CONSTRAINT "PlacementNote_endorsementParticipantId_tenantId_fkey"
  FOREIGN KEY ("endorsementParticipantId", "tenantId")
  REFERENCES reinsurance."PlacementEndorsementParticipant"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE INDEX "PlacementNote_tenantId_endorsementId_status_createdAt_idx"
  ON reinsurance."PlacementNote"("tenantId", "endorsementId", "status", "createdAt");

CREATE INDEX "PlacementNote_tenantId_endorsementClosingId_status_idx"
  ON reinsurance."PlacementNote"("tenantId", "endorsementClosingId", "status");

CREATE INDEX "PlacementNote_tenantId_endorsementParticipantId_createdAt_idx"
  ON reinsurance."PlacementNote"("tenantId", "endorsementParticipantId", "createdAt");
