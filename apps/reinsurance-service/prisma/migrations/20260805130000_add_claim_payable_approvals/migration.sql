CREATE TABLE "reinsurance"."PlacementClaimPayableApproval" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "approvalVersion" INTEGER NOT NULL DEFAULT 1,
  "approvedPayableAmount" DECIMAL(18,2) NOT NULL,
  "finalLossAmount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL,
  "approvedByUserId" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlacementClaimPayableApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementClaimPayableApproval_id_tenantId_key"
  ON "reinsurance"."PlacementClaimPayableApproval"("id", "tenantId");

CREATE UNIQUE INDEX "PlacementClaimPayableApproval_tenantId_claimId_approvalVersion_key"
  ON "reinsurance"."PlacementClaimPayableApproval"("tenantId", "claimId", "approvalVersion");

CREATE INDEX "PlacementClaimPayableApproval_tenantId_placementId_claimId_approvedAt_idx"
  ON "reinsurance"."PlacementClaimPayableApproval"("tenantId", "placementId", "claimId", "approvedAt");

ALTER TABLE "reinsurance"."PlacementClaimPayableApproval"
  ADD CONSTRAINT "PlacementClaimPayableApproval_claimId_tenantId_fkey"
  FOREIGN KEY ("claimId", "tenantId")
  REFERENCES "reinsurance"."PlacementClaim"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
