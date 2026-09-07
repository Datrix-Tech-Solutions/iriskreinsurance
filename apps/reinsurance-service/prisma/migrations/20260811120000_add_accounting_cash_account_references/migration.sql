-- Store the Accounting-owned cash account selected during financial
-- confirmation so cash-impact source events can be bridged into Cashbook.
ALTER TABLE "reinsurance"."PlacementPayment"
  ADD COLUMN "accountingCashAccountId" TEXT;

ALTER TABLE "reinsurance"."PlacementClaimRecoveryReceipt"
  ADD COLUMN "accountingCashAccountId" TEXT;

ALTER TABLE "reinsurance"."PlacementClaimCedantSettlement"
  ADD COLUMN "accountingCashAccountId" TEXT;

CREATE INDEX "PlacementPayment_tenantId_accountingCashAccountId_idx"
  ON "reinsurance"."PlacementPayment"("tenantId", "accountingCashAccountId");

CREATE INDEX "PlacementClaimRecoveryReceipt_tenantId_accountingCashAccountId_idx"
  ON "reinsurance"."PlacementClaimRecoveryReceipt"("tenantId", "accountingCashAccountId");

CREATE INDEX "PlacementClaimCedantSettlement_tenantId_accountingCashAccountId_idx"
  ON "reinsurance"."PlacementClaimCedantSettlement"("tenantId", "accountingCashAccountId");
