CREATE TYPE reinsurance."PlacementClaimCashCallStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'PAID',
  'VOID'
);

CREATE TABLE reinsurance."PlacementClaimCashCall" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "allocationId" TEXT NOT NULL,
  "counterpartyId" TEXT NOT NULL,
  "cashCallNumber" TEXT NOT NULL,
  "status" reinsurance."PlacementClaimCashCallStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "basisAmount" DECIMAL(18, 2) NOT NULL,
  "signedLinePercent" DECIMAL(7, 4) NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlacementClaimCashCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementClaimCashCall_id_tenantId_key"
  ON reinsurance."PlacementClaimCashCall"("id", "tenantId");

CREATE UNIQUE INDEX "PlacementClaimCashCall_tenantId_placementId_cashCallNumber_key"
  ON reinsurance."PlacementClaimCashCall"("tenantId", "placementId", "cashCallNumber");

CREATE INDEX "PlacementClaimCashCall_tenantId_placementId_claimId_status_createdAt_idx"
  ON reinsurance."PlacementClaimCashCall"("tenantId", "placementId", "claimId", "status", "createdAt");

CREATE INDEX "PlacementClaimCashCall_tenantId_claimId_status_idx"
  ON reinsurance."PlacementClaimCashCall"("tenantId", "claimId", "status");

CREATE INDEX "PlacementClaimCashCall_tenantId_allocationId_status_idx"
  ON reinsurance."PlacementClaimCashCall"("tenantId", "allocationId", "status");

CREATE INDEX "PlacementClaimCashCall_tenantId_counterpartyId_createdAt_idx"
  ON reinsurance."PlacementClaimCashCall"("tenantId", "counterpartyId", "createdAt");

ALTER TABLE reinsurance."PlacementClaimCashCall"
  ADD CONSTRAINT "PlacementClaimCashCall_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES reinsurance."Placement"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementClaimCashCall"
  ADD CONSTRAINT "PlacementClaimCashCall_claimId_tenantId_fkey"
  FOREIGN KEY ("claimId", "tenantId")
  REFERENCES reinsurance."PlacementClaim"("id", "tenantId")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementClaimCashCall"
  ADD CONSTRAINT "PlacementClaimCashCall_allocationId_tenantId_fkey"
  FOREIGN KEY ("allocationId", "tenantId")
  REFERENCES reinsurance."PlacementClaimAllocation"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementClaimCashCall"
  ADD CONSTRAINT "PlacementClaimCashCall_counterpartyId_tenantId_fkey"
  FOREIGN KEY ("counterpartyId", "tenantId")
  REFERENCES reinsurance."Counterparty"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
