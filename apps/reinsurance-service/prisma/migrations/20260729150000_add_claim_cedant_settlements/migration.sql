-- Add explicit Broker -> Cedant claim settlement approval and history.
CREATE TYPE "reinsurance"."PlacementClaimCedantSettlementStatus" AS ENUM ('RECORDED', 'REVERSED');

ALTER TABLE "reinsurance"."PlacementClaim"
  ADD COLUMN "approvedPayableAmount" DECIMAL(18,2),
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedByUserId" TEXT;

CREATE TABLE "reinsurance"."PlacementClaimCedantSettlement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "settlementDate" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "status" "reinsurance"."PlacementClaimCedantSettlementStatus" NOT NULL DEFAULT 'RECORDED',
  "reversalOfSettlementId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlacementClaimCedantSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementClaimCedantSettlement_id_tenantId_key"
  ON "reinsurance"."PlacementClaimCedantSettlement"("id", "tenantId");

CREATE INDEX "PlacementClaimCedantSettlement_tenantId_placementId_claim_idx"
  ON "reinsurance"."PlacementClaimCedantSettlement"("tenantId", "placementId", "claimId", "status", "createdAt");

CREATE INDEX "PlacementClaimCedantSettlement_tenantId_claimId_status_idx"
  ON "reinsurance"."PlacementClaimCedantSettlement"("tenantId", "claimId", "status", "createdAt");

CREATE INDEX "PlacementClaimCedantSettlement_tenantId_reversalOfSettlement_idx"
  ON "reinsurance"."PlacementClaimCedantSettlement"("tenantId", "reversalOfSettlementId");

ALTER TABLE "reinsurance"."PlacementClaimCedantSettlement"
  ADD CONSTRAINT "PlacementClaimCedantSettlement_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES "reinsurance"."Placement"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimCedantSettlement"
  ADD CONSTRAINT "PlacementClaimCedantSettlement_claimId_tenantId_fkey"
  FOREIGN KEY ("claimId", "tenantId")
  REFERENCES "reinsurance"."PlacementClaim"("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimCedantSettlement"
  ADD CONSTRAINT "PlacementClaimCedantSettlement_reversalOfSettlementId_fkey"
  FOREIGN KEY ("reversalOfSettlementId")
  REFERENCES "reinsurance"."PlacementClaimCedantSettlement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
