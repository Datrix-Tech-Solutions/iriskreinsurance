CREATE TYPE "reinsurance"."PlacementSettlementMethod" AS ENUM (
  'BANK_TRANSFER',
  'CHEQUE',
  'CASH',
  'MOBILE_MONEY',
  'INTERNAL_OFFSET',
  'JOURNAL',
  'OTHER'
);

ALTER TABLE "reinsurance"."PlacementPayment"
  ADD COLUMN "settlementMethod" "reinsurance"."PlacementSettlementMethod",
  ADD COLUMN "settlementCurrency" TEXT;
