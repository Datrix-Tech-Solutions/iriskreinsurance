CREATE TABLE "reinsurance"."PlacementClaimRecoveryApproval" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "allocationId" TEXT NOT NULL,
  "cashCallId" TEXT,
  "counterpartyId" TEXT NOT NULL,
  "approvalVersion" INTEGER NOT NULL DEFAULT 1,
  "approvedAmount" DECIMAL(18, 2) NOT NULL,
  "eligibleAmount" DECIMAL(18, 2) NOT NULL,
  "currency" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL,
  "approvedByUserId" TEXT NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlacementClaimRecoveryApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementClaimRecoveryApproval_id_tenantId_key"
  ON "reinsurance"."PlacementClaimRecoveryApproval"("id", "tenantId");

CREATE UNIQUE INDEX "PlacementClaimRecoveryApproval_tenantId_allocationId_approvalVersion_key"
  ON "reinsurance"."PlacementClaimRecoveryApproval"("tenantId", "allocationId", "approvalVersion");

CREATE INDEX "PlacementClaimRecoveryApproval_tenantId_placementId_claimId_approvedAt_idx"
  ON "reinsurance"."PlacementClaimRecoveryApproval"("tenantId", "placementId", "claimId", "approvedAt");

CREATE INDEX "PlacementClaimRecoveryApproval_tenantId_claimId_allocationId_idx"
  ON "reinsurance"."PlacementClaimRecoveryApproval"("tenantId", "claimId", "allocationId");

CREATE INDEX "PlacementClaimRecoveryApproval_tenantId_cashCallId_idx"
  ON "reinsurance"."PlacementClaimRecoveryApproval"("tenantId", "cashCallId");

CREATE INDEX "PlacementClaimRecoveryApproval_tenantId_counterpartyId_approvedAt_idx"
  ON "reinsurance"."PlacementClaimRecoveryApproval"("tenantId", "counterpartyId", "approvedAt");

ALTER TABLE "reinsurance"."PlacementClaimRecoveryApproval"
  ADD CONSTRAINT "PlacementClaimRecoveryApproval_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES "reinsurance"."Placement"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryApproval"
  ADD CONSTRAINT "PlacementClaimRecoveryApproval_claimId_tenantId_fkey"
  FOREIGN KEY ("claimId", "tenantId")
  REFERENCES "reinsurance"."PlacementClaim"("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryApproval"
  ADD CONSTRAINT "PlacementClaimRecoveryApproval_allocationId_tenantId_fkey"
  FOREIGN KEY ("allocationId", "tenantId")
  REFERENCES "reinsurance"."PlacementClaimAllocation"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryApproval"
  ADD CONSTRAINT "PlacementClaimRecoveryApproval_cashCallId_tenantId_fkey"
  FOREIGN KEY ("cashCallId", "tenantId")
  REFERENCES "reinsurance"."PlacementClaimCashCall"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryApproval"
  ADD CONSTRAINT "PlacementClaimRecoveryApproval_counterpartyId_tenantId_fkey"
  FOREIGN KEY ("counterpartyId", "tenantId")
  REFERENCES "reinsurance"."Counterparty"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
