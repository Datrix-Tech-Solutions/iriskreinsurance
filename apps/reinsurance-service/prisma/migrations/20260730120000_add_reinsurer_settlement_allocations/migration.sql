-- Add bank-confirmed settlement domain support for Reinsurance payments.
ALTER TYPE "reinsurance"."PlacementPaymentStatus" ADD VALUE IF NOT EXISTS 'BANK_CONFIRMED';
ALTER TYPE "reinsurance"."PlacementPaymentStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "reinsurance"."PlacementPaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "reinsurance"."PlacementPayment"
  ADD COLUMN "settlementReference" TEXT,
  ADD COLUMN "bankReference" TEXT,
  ADD COLUMN "bankConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "bankConfirmedByUserId" TEXT,
  ADD COLUMN "agreedExchangeRate" DECIMAL(18,8),
  ADD COLUMN "bankChargeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "withholdingTaxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE TABLE "reinsurance"."PlacementPaymentAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "allocatedAmount" DECIMAL(18,2) NOT NULL,
  "allocatedCurrency" TEXT NOT NULL,
  "obligationAmount" DECIMAL(18,2) NOT NULL,
  "obligationCurrency" TEXT NOT NULL,
  "agreedExchangeRate" DECIMAL(18,8),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlacementPaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementPaymentAllocation_id_tenantId_key"
  ON "reinsurance"."PlacementPaymentAllocation"("id", "tenantId");

CREATE UNIQUE INDEX "PlacementPaymentAllocation_tenantId_paymentId_noteId_key"
  ON "reinsurance"."PlacementPaymentAllocation"("tenantId", "paymentId", "noteId");

CREATE INDEX "PlacementPaymentAllocation_tenantId_placementId_createdAt_idx"
  ON "reinsurance"."PlacementPaymentAllocation"("tenantId", "placementId", "createdAt");

CREATE INDEX "PlacementPaymentAllocation_tenantId_noteId_createdAt_idx"
  ON "reinsurance"."PlacementPaymentAllocation"("tenantId", "noteId", "createdAt");

CREATE INDEX "PlacementPaymentAllocation_tenantId_paymentId_createdAt_idx"
  ON "reinsurance"."PlacementPaymentAllocation"("tenantId", "paymentId", "createdAt");

ALTER TABLE "reinsurance"."PlacementPaymentAllocation"
  ADD CONSTRAINT "PlacementPaymentAllocation_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES "reinsurance"."Placement"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementPaymentAllocation"
  ADD CONSTRAINT "PlacementPaymentAllocation_paymentId_tenantId_fkey"
  FOREIGN KEY ("paymentId", "tenantId")
  REFERENCES "reinsurance"."PlacementPayment"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementPaymentAllocation"
  ADD CONSTRAINT "PlacementPaymentAllocation_noteId_tenantId_fkey"
  FOREIGN KEY ("noteId", "tenantId")
  REFERENCES "reinsurance"."PlacementNote"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
