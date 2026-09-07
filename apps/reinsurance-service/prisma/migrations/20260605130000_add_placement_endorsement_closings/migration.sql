-- Add endorsement-scoped closing snapshots.
--
-- Endorsement closings are separate child financial snapshots for accepted
-- endorsement participants. They do not mutate placement closings, placement
-- participants, payments or notes.

CREATE TABLE reinsurance."PlacementEndorsementClosing" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "endorsementId" TEXT NOT NULL,
  "endorsementParticipantId" TEXT NOT NULL,
  "closingNumber" TEXT NOT NULL,
  "status" reinsurance."PlacementClosingStatus" NOT NULL DEFAULT 'DRAFT',
  "signedLinePercent" DECIMAL(7,4) NOT NULL,
  "sharePercent" DECIMAL(7,4),
  "sumInsuredSnapshot" DECIMAL(18,2),
  "premiumSnapshot" DECIMAL(18,2) NOT NULL,
  "commissionPercent" DECIMAL(7,4),
  "commissionAmount" DECIMAL(18,2),
  "brokeragePercent" DECIMAL(5,2),
  "brokerageAmount" DECIMAL(18,2),
  "netPremium" DECIMAL(18,2),
  "currency" TEXT,
  "issuedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlacementEndorsementClosing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementEndorsementClosing_id_tenantId_key"
  ON reinsurance."PlacementEndorsementClosing"("id", "tenantId");

CREATE UNIQUE INDEX "PlacementEndorsementClosing_tenantId_placementId_closingNumber_key"
  ON reinsurance."PlacementEndorsementClosing"("tenantId", "placementId", "closingNumber");

CREATE INDEX "PlacementEndorsementClosing_tenantId_placementId_idx"
  ON reinsurance."PlacementEndorsementClosing"("tenantId", "placementId");

CREATE INDEX "PlacementEndorsementClosing_tenantId_endorsementId_idx"
  ON reinsurance."PlacementEndorsementClosing"("tenantId", "endorsementId");

CREATE INDEX "PlacementEndorsementClosing_tenantId_endorsementParticipantId_idx"
  ON reinsurance."PlacementEndorsementClosing"("tenantId", "endorsementParticipantId");

CREATE INDEX "PlacementEndorsementClosing_tenantId_placementId_status_idx"
  ON reinsurance."PlacementEndorsementClosing"("tenantId", "placementId", "status");

ALTER TABLE reinsurance."PlacementEndorsementClosing"
  ADD CONSTRAINT "PlacementEndorsementClosing_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES reinsurance."Placement"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementEndorsementClosing"
  ADD CONSTRAINT "PlacementEndorsementClosing_endorsementId_tenantId_fkey"
  FOREIGN KEY ("endorsementId", "tenantId")
  REFERENCES reinsurance."PlacementEndorsement"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementEndorsementClosing"
  ADD CONSTRAINT "PlacementEndorsementClosing_endorsementParticipantId_tenantId_fkey"
  FOREIGN KEY ("endorsementParticipantId", "tenantId")
  REFERENCES reinsurance."PlacementEndorsementParticipant"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
