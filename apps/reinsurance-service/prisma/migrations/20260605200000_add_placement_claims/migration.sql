CREATE TYPE reinsurance."PlacementClaimStatus" AS ENUM (
  'DRAFT',
  'NOTIFIED',
  'RESERVED',
  'PARTIALLY_SETTLED',
  'SETTLED',
  'DECLINED',
  'CLOSED',
  'VOID'
);

CREATE TYPE reinsurance."PlacementClaimAllocationStatus" AS ENUM (
  'DRAFT',
  'NOTIFIED',
  'CASH_CALLED',
  'PARTIALLY_PAID',
  'PAID',
  'VOID'
);

CREATE TABLE reinsurance."PlacementClaim" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "claimNumber" TEXT NOT NULL,
  "status" reinsurance."PlacementClaimStatus" NOT NULL DEFAULT 'DRAFT',
  "occurrenceDate" TIMESTAMP(3) NOT NULL,
  "reportedDate" TIMESTAMP(3) NOT NULL,
  "claimCause" TEXT NOT NULL,
  "occurrenceDetails" TEXT,
  "currency" TEXT NOT NULL,
  "estimatedLossAmount" DECIMAL(18, 2) NOT NULL,
  "finalLossAmount" DECIMAL(18, 2),
  "finalizedAt" TIMESTAMP(3),
  "finalizedByUserId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "closedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlacementClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE reinsurance."PlacementClaimAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "placementClosingId" TEXT,
  "endorsementClosingId" TEXT,
  "participantId" TEXT,
  "endorsementParticipantId" TEXT,
  "counterpartyId" TEXT NOT NULL,
  "signedLinePercent" DECIMAL(7, 4) NOT NULL,
  "basisAmount" DECIMAL(18, 2) NOT NULL,
  "allocatedEstimatedLossAmount" DECIMAL(18, 2) NOT NULL,
  "allocatedFinalLossAmount" DECIMAL(18, 2),
  "cashCallAmount" DECIMAL(18, 2),
  "paidAmount" DECIMAL(18, 2),
  "status" reinsurance."PlacementClaimAllocationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlacementClaimAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlacementClaimAllocation_one_closing_source_check"
    CHECK (
      ("placementClosingId" IS NOT NULL AND "endorsementClosingId" IS NULL)
      OR ("placementClosingId" IS NULL AND "endorsementClosingId" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "PlacementClaim_id_tenantId_key"
  ON reinsurance."PlacementClaim"("id", "tenantId");

CREATE UNIQUE INDEX "PlacementClaim_tenantId_placementId_claimNumber_key"
  ON reinsurance."PlacementClaim"("tenantId", "placementId", "claimNumber");

CREATE INDEX "PlacementClaim_tenantId_placementId_status_createdAt_idx"
  ON reinsurance."PlacementClaim"("tenantId", "placementId", "status", "createdAt");

CREATE INDEX "PlacementClaim_tenantId_status_createdAt_idx"
  ON reinsurance."PlacementClaim"("tenantId", "status", "createdAt");

CREATE UNIQUE INDEX "PlacementClaimAllocation_id_tenantId_key"
  ON reinsurance."PlacementClaimAllocation"("id", "tenantId");

CREATE INDEX "PlacementClaimAllocation_tenantId_placementId_claimId_idx"
  ON reinsurance."PlacementClaimAllocation"("tenantId", "placementId", "claimId");

CREATE INDEX "PlacementClaimAllocation_tenantId_claimId_status_idx"
  ON reinsurance."PlacementClaimAllocation"("tenantId", "claimId", "status");

CREATE INDEX "PlacementClaimAllocation_tenantId_placementClosingId_idx"
  ON reinsurance."PlacementClaimAllocation"("tenantId", "placementClosingId");

CREATE INDEX "PlacementClaimAllocation_tenantId_endorsementClosingId_idx"
  ON reinsurance."PlacementClaimAllocation"("tenantId", "endorsementClosingId");

CREATE INDEX "PlacementClaimAllocation_tenantId_counterpartyId_createdAt_idx"
  ON reinsurance."PlacementClaimAllocation"("tenantId", "counterpartyId", "createdAt");

ALTER TABLE reinsurance."PlacementClaim"
  ADD CONSTRAINT "PlacementClaim_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES reinsurance."Placement"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementClaimAllocation"
  ADD CONSTRAINT "PlacementClaimAllocation_claimId_tenantId_fkey"
  FOREIGN KEY ("claimId", "tenantId")
  REFERENCES reinsurance."PlacementClaim"("id", "tenantId")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementClaimAllocation"
  ADD CONSTRAINT "PlacementClaimAllocation_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES reinsurance."Placement"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementClaimAllocation"
  ADD CONSTRAINT "PlacementClaimAllocation_placementClosingId_fkey"
  FOREIGN KEY ("placementClosingId")
  REFERENCES reinsurance."PlacementClosing"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementClaimAllocation"
  ADD CONSTRAINT "PlacementClaimAllocation_endorsementClosingId_tenantId_fkey"
  FOREIGN KEY ("endorsementClosingId", "tenantId")
  REFERENCES reinsurance."PlacementEndorsementClosing"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementClaimAllocation"
  ADD CONSTRAINT "PlacementClaimAllocation_participantId_tenantId_fkey"
  FOREIGN KEY ("participantId", "tenantId")
  REFERENCES reinsurance."PlacementParticipant"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementClaimAllocation"
  ADD CONSTRAINT "PlacementClaimAllocation_endorsementParticipantId_tenantId_fkey"
  FOREIGN KEY ("endorsementParticipantId", "tenantId")
  REFERENCES reinsurance."PlacementEndorsementParticipant"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementClaimAllocation"
  ADD CONSTRAINT "PlacementClaimAllocation_counterpartyId_tenantId_fkey"
  FOREIGN KEY ("counterpartyId", "tenantId")
  REFERENCES reinsurance."Counterparty"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
