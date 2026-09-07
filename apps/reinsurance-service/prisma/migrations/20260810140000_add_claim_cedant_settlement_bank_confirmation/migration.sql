ALTER TYPE "reinsurance"."PlacementClaimCedantSettlementStatus"
  ADD VALUE IF NOT EXISTS 'BANK_CONFIRMED';

ALTER TABLE "reinsurance"."PlacementClaimCedantSettlement"
  ADD COLUMN "payableApprovalId" TEXT,
  ADD COLUMN "settlementMethod" "reinsurance"."PlacementSettlementMethod",
  ADD COLUMN "settlementCurrency" TEXT,
  ADD COLUMN "bankReference" TEXT,
  ADD COLUMN "bankConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "bankConfirmedByUserId" TEXT,
  ADD COLUMN "agreedExchangeRate" DECIMAL(18,8),
  ADD COLUMN "bankChargeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE INDEX "PlacementClaimCedantSettlement_tenantId_payableApprovalId_status_createdAt_idx"
  ON "reinsurance"."PlacementClaimCedantSettlement"("tenantId", "payableApprovalId", "status", "createdAt");

CREATE INDEX "PlacementClaimCedantSettlement_tenantId_status_bankConfirmedAt_idx"
  ON "reinsurance"."PlacementClaimCedantSettlement"("tenantId", "status", "bankConfirmedAt");

ALTER TABLE "reinsurance"."PlacementClaimCedantSettlement"
  ADD CONSTRAINT "PlacementClaimCedantSettlement_payableApprovalId_tenantId_fkey"
  FOREIGN KEY ("payableApprovalId", "tenantId")
  REFERENCES "reinsurance"."PlacementClaimPayableApproval"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
