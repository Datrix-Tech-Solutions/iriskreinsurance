ALTER TYPE "reinsurance"."PlacementClaimRecoveryReceiptStatus"
  ADD VALUE IF NOT EXISTS 'BANK_CONFIRMED';

ALTER TABLE "reinsurance"."PlacementClaimRecoveryReceipt"
  ADD COLUMN "recoveryApprovalId" TEXT,
  ADD COLUMN "settlementMethod" "reinsurance"."PlacementSettlementMethod",
  ADD COLUMN "settlementCurrency" TEXT,
  ADD COLUMN "bankReference" TEXT,
  ADD COLUMN "bankConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "bankConfirmedByUserId" TEXT,
  ADD COLUMN "agreedExchangeRate" DECIMAL(18,8),
  ADD COLUMN "bankChargeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE INDEX "PlacementClaimRecoveryReceipt_tenantId_recoveryApprovalId_status_createdAt_idx"
  ON "reinsurance"."PlacementClaimRecoveryReceipt"("tenantId", "recoveryApprovalId", "status", "createdAt");

CREATE INDEX "PlacementClaimRecoveryReceipt_tenantId_status_bankConfirmedAt_idx"
  ON "reinsurance"."PlacementClaimRecoveryReceipt"("tenantId", "status", "bankConfirmedAt");

ALTER TABLE "reinsurance"."PlacementClaimRecoveryReceipt"
  ADD CONSTRAINT "PlacementClaimRecoveryReceipt_recoveryApprovalId_tenantId_fkey"
  FOREIGN KEY ("recoveryApprovalId", "tenantId")
  REFERENCES "reinsurance"."PlacementClaimRecoveryApproval"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
