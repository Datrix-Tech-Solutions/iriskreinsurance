CREATE TYPE "reinsurance"."PlacementClaimRecoveryReceiptStatus" AS ENUM ('RECORDED', 'REVERSED');

CREATE TABLE "reinsurance"."PlacementClaimRecoveryReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "cashCallId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "status" "reinsurance"."PlacementClaimRecoveryReceiptStatus" NOT NULL DEFAULT 'RECORDED',
    "reversalOfReceiptId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementClaimRecoveryReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlacementClaimRecoveryReceipt_amount_positive_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "PlacementClaimRecoveryReceipt_id_tenantId_key" ON "reinsurance"."PlacementClaimRecoveryReceipt"("id", "tenantId");
CREATE INDEX "PlacementClaimRecoveryReceipt_tenantId_placementId_claimId_status_createdAt_idx" ON "reinsurance"."PlacementClaimRecoveryReceipt"("tenantId", "placementId", "claimId", "status", "createdAt");
CREATE INDEX "PlacementClaimRecoveryReceipt_tenantId_cashCallId_status_createdAt_idx" ON "reinsurance"."PlacementClaimRecoveryReceipt"("tenantId", "cashCallId", "status", "createdAt");
CREATE INDEX "PlacementClaimRecoveryReceipt_tenantId_allocationId_status_createdAt_idx" ON "reinsurance"."PlacementClaimRecoveryReceipt"("tenantId", "allocationId", "status", "createdAt");
CREATE INDEX "PlacementClaimRecoveryReceipt_tenantId_counterpartyId_createdAt_idx" ON "reinsurance"."PlacementClaimRecoveryReceipt"("tenantId", "counterpartyId", "createdAt");
CREATE INDEX "PlacementClaimRecoveryReceipt_tenantId_reversalOfReceiptId_idx" ON "reinsurance"."PlacementClaimRecoveryReceipt"("tenantId", "reversalOfReceiptId");
CREATE UNIQUE INDEX "PlacementClaimRecoveryReceipt_reversalOfReceiptId_unique_idx" ON "reinsurance"."PlacementClaimRecoveryReceipt"("reversalOfReceiptId") WHERE "reversalOfReceiptId" IS NOT NULL;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryReceipt"
  ADD CONSTRAINT "PlacementClaimRecoveryReceipt_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES "reinsurance"."Placement"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryReceipt"
  ADD CONSTRAINT "PlacementClaimRecoveryReceipt_claimId_tenantId_fkey"
  FOREIGN KEY ("claimId", "tenantId")
  REFERENCES "reinsurance"."PlacementClaim"("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryReceipt"
  ADD CONSTRAINT "PlacementClaimRecoveryReceipt_allocationId_tenantId_fkey"
  FOREIGN KEY ("allocationId", "tenantId")
  REFERENCES "reinsurance"."PlacementClaimAllocation"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryReceipt"
  ADD CONSTRAINT "PlacementClaimRecoveryReceipt_cashCallId_tenantId_fkey"
  FOREIGN KEY ("cashCallId", "tenantId")
  REFERENCES "reinsurance"."PlacementClaimCashCall"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryReceipt"
  ADD CONSTRAINT "PlacementClaimRecoveryReceipt_counterpartyId_tenantId_fkey"
  FOREIGN KEY ("counterpartyId", "tenantId")
  REFERENCES "reinsurance"."Counterparty"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryReceipt"
  ADD CONSTRAINT "PlacementClaimRecoveryReceipt_reversalOfReceiptId_fkey"
  FOREIGN KEY ("reversalOfReceiptId")
  REFERENCES "reinsurance"."PlacementClaimRecoveryReceipt"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
