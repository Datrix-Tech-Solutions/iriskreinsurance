-- Add PlacementPayment foundation.
--
-- Payment records are append-first financial facts. The first RECORDED payment
-- becomes the hard-lock source used by PlacementFinancialActivityReader. Later
-- corrections are represented by reversal records rather than destructive edits.

CREATE TYPE "reinsurance"."PlacementPaymentType" AS ENUM (
  'PREMIUM_RECEIVED',
  'REINSURER_DISBURSEMENT',
  'CLAIM_SETTLEMENT'
);

CREATE TYPE "reinsurance"."PlacementPaymentDirection" AS ENUM (
  'INBOUND',
  'OUTBOUND'
);

CREATE TYPE "reinsurance"."PlacementPaymentStatus" AS ENUM (
  'RECORDED',
  'REVERSED'
);

CREATE TABLE "reinsurance"."PlacementPayment" (
  "id"                  TEXT NOT NULL,
  "tenantId"            TEXT NOT NULL,
  "placementId"         TEXT NOT NULL,
  "closingId"           TEXT,
  "participantId"       TEXT,
  "counterpartyId"      TEXT NOT NULL,
  "type"                "reinsurance"."PlacementPaymentType" NOT NULL,
  "direction"           "reinsurance"."PlacementPaymentDirection" NOT NULL,
  "amount"              DECIMAL(18,2) NOT NULL,
  "currency"            TEXT NOT NULL,
  "paymentDate"         TIMESTAMP(3) NOT NULL,
  "reference"           TEXT,
  "notes"               TEXT,
  "status"              "reinsurance"."PlacementPaymentStatus" NOT NULL DEFAULT 'RECORDED',
  "reversalOfPaymentId" TEXT,
  "createdByUserId"     TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlacementPayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "reinsurance"."PlacementPayment"
  ADD CONSTRAINT "PlacementPayment_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES "reinsurance"."Placement"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementPayment"
  ADD CONSTRAINT "PlacementPayment_counterpartyId_tenantId_fkey"
  FOREIGN KEY ("counterpartyId", "tenantId")
  REFERENCES "reinsurance"."Counterparty"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementPayment"
  ADD CONSTRAINT "PlacementPayment_participantId_tenantId_fkey"
  FOREIGN KEY ("participantId", "tenantId")
  REFERENCES "reinsurance"."PlacementParticipant"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementPayment"
  ADD CONSTRAINT "PlacementPayment_closingId_fkey"
  FOREIGN KEY ("closingId")
  REFERENCES "reinsurance"."PlacementClosing"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementPayment"
  ADD CONSTRAINT "PlacementPayment_reversalOfPaymentId_fkey"
  FOREIGN KEY ("reversalOfPaymentId")
  REFERENCES "reinsurance"."PlacementPayment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PlacementPayment_id_tenantId_key"
  ON "reinsurance"."PlacementPayment"("id", "tenantId");

CREATE INDEX "PlacementPayment_tenantId_placementId_status_createdAt_idx"
  ON "reinsurance"."PlacementPayment"("tenantId", "placementId", "status", "createdAt");

CREATE INDEX "PlacementPayment_tenantId_placementId_type_createdAt_idx"
  ON "reinsurance"."PlacementPayment"("tenantId", "placementId", "type", "createdAt");

CREATE INDEX "PlacementPayment_tenantId_counterpartyId_createdAt_idx"
  ON "reinsurance"."PlacementPayment"("tenantId", "counterpartyId", "createdAt");

CREATE INDEX "PlacementPayment_tenantId_participantId_createdAt_idx"
  ON "reinsurance"."PlacementPayment"("tenantId", "participantId", "createdAt");

CREATE INDEX "PlacementPayment_tenantId_closingId_createdAt_idx"
  ON "reinsurance"."PlacementPayment"("tenantId", "closingId", "createdAt");

CREATE INDEX "PlacementPayment_tenantId_reversalOfPaymentId_idx"
  ON "reinsurance"."PlacementPayment"("tenantId", "reversalOfPaymentId");
