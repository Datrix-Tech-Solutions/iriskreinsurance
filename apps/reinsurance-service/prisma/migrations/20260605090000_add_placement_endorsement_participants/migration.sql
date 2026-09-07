-- Add endorsement-scoped participant workflow.
--
-- Endorsement participants are versioned child workflow records. They do not
-- mutate original placement participants, closings, payments or notes.

CREATE TYPE reinsurance."PlacementEndorsementParticipantStatus" AS ENUM (
  'INVITED',
  'OFFER_SENT',
  'QUOTED',
  'ACCEPTED',
  'DECLINED',
  'CLOSED'
);

ALTER TABLE reinsurance."PlacementEndorsement"
  ADD COLUMN "targetPercent" DECIMAL(7,4);

CREATE TABLE reinsurance."PlacementEndorsementParticipant" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "endorsementId" TEXT NOT NULL,
  "originalParticipantId" TEXT,
  "counterpartyId" TEXT NOT NULL,
  "status" reinsurance."PlacementEndorsementParticipantStatus" NOT NULL DEFAULT 'INVITED',
  "sharePercent" DECIMAL(7,4),
  "signedLinePercent" DECIMAL(7,4),
  "notes" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlacementEndorsementParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementEndorsementParticipant_id_tenantId_key"
  ON reinsurance."PlacementEndorsementParticipant"("id", "tenantId");

CREATE INDEX "PlacementEndorsementParticipant_tenantId_placementId_endorsementId_idx"
  ON reinsurance."PlacementEndorsementParticipant"("tenantId", "placementId", "endorsementId");

CREATE INDEX "PlacementEndorsementParticipant_tenantId_endorsementId_status_idx"
  ON reinsurance."PlacementEndorsementParticipant"("tenantId", "endorsementId", "status");

CREATE INDEX "PlacementEndorsementParticipant_tenantId_endorsementId_counterpartyId_idx"
  ON reinsurance."PlacementEndorsementParticipant"("tenantId", "endorsementId", "counterpartyId");

CREATE INDEX "PlacementEndorsementParticipant_tenantId_originalParticipantId_idx"
  ON reinsurance."PlacementEndorsementParticipant"("tenantId", "originalParticipantId");

CREATE INDEX "PlacementEndorsementParticipant_tenantId_counterpartyId_createdAt_idx"
  ON reinsurance."PlacementEndorsementParticipant"("tenantId", "counterpartyId", "createdAt");

ALTER TABLE reinsurance."PlacementEndorsementParticipant"
  ADD CONSTRAINT "PlacementEndorsementParticipant_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES reinsurance."Placement"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementEndorsementParticipant"
  ADD CONSTRAINT "PlacementEndorsementParticipant_endorsementId_tenantId_fkey"
  FOREIGN KEY ("endorsementId", "tenantId")
  REFERENCES reinsurance."PlacementEndorsement"("id", "tenantId")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementEndorsementParticipant"
  ADD CONSTRAINT "PlacementEndorsementParticipant_originalParticipantId_tenantId_fkey"
  FOREIGN KEY ("originalParticipantId", "tenantId")
  REFERENCES reinsurance."PlacementParticipant"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementEndorsementParticipant"
  ADD CONSTRAINT "PlacementEndorsementParticipant_counterpartyId_tenantId_fkey"
  FOREIGN KEY ("counterpartyId", "tenantId")
  REFERENCES reinsurance."Counterparty"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
