-- Add PlacementNote foundation for debit and credit notes.
--
-- Notes are generated from confirmed PlacementClosing snapshots and do not
-- financially lock a placement. Payment remains the only hard-lock trigger.

CREATE TYPE "reinsurance"."PlacementNoteType" AS ENUM (
  'DEBIT_NOTE',
  'CREDIT_NOTE'
);

CREATE TYPE "reinsurance"."PlacementNoteDirection" AS ENUM (
  'CEDANT_TO_BROKER',
  'BROKER_TO_REINSURER',
  'BROKER_TO_CEDANT',
  'REINSURER_TO_BROKER'
);

CREATE TYPE "reinsurance"."PlacementNoteStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'VOID'
);

CREATE TABLE "reinsurance"."PlacementNote" (
  "id"                    TEXT NOT NULL,
  "tenantId"              TEXT NOT NULL,
  "placementId"           TEXT NOT NULL,
  "closingId"             TEXT,
  "participantId"         TEXT,
  "counterpartyId"        TEXT NOT NULL,
  "settledByPaymentId"    TEXT,
  "type"                  "reinsurance"."PlacementNoteType" NOT NULL,
  "direction"             "reinsurance"."PlacementNoteDirection" NOT NULL,
  "noteNumber"            TEXT NOT NULL,
  "status"                "reinsurance"."PlacementNoteStatus" NOT NULL DEFAULT 'DRAFT',
  "currency"              TEXT NOT NULL,
  "grossAmount"           DECIMAL(18,2) NOT NULL,
  "commissionPercent"     DECIMAL(7,4),
  "commissionAmount"      DECIMAL(18,2),
  "brokeragePercent"      DECIMAL(5,2),
  "brokerageAmount"       DECIMAL(18,2),
  "nicLevyPercent"        DECIMAL(7,4) NOT NULL DEFAULT 0,
  "nicLevyAmount"         DECIMAL(18,2) NOT NULL DEFAULT 0,
  "withholdingTaxPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "withholdingTaxAmount"  DECIMAL(18,2) NOT NULL DEFAULT 0,
  "netAmount"             DECIMAL(18,2) NOT NULL,
  "noteDate"              TIMESTAMP(3) NOT NULL,
  "issuedAt"              TIMESTAMP(3),
  "voidedAt"              TIMESTAMP(3),
  "voidReason"            TEXT,
  "createdByUserId"       TEXT NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlacementNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "reinsurance"."PlacementNote"
  ADD CONSTRAINT "PlacementNote_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES "reinsurance"."Placement"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementNote"
  ADD CONSTRAINT "PlacementNote_counterpartyId_tenantId_fkey"
  FOREIGN KEY ("counterpartyId", "tenantId")
  REFERENCES "reinsurance"."Counterparty"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementNote"
  ADD CONSTRAINT "PlacementNote_participantId_tenantId_fkey"
  FOREIGN KEY ("participantId", "tenantId")
  REFERENCES "reinsurance"."PlacementParticipant"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementNote"
  ADD CONSTRAINT "PlacementNote_closingId_fkey"
  FOREIGN KEY ("closingId")
  REFERENCES "reinsurance"."PlacementClosing"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementNote"
  ADD CONSTRAINT "PlacementNote_settledByPaymentId_fkey"
  FOREIGN KEY ("settledByPaymentId")
  REFERENCES "reinsurance"."PlacementPayment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PlacementNote_id_tenantId_key"
  ON "reinsurance"."PlacementNote"("id", "tenantId");

CREATE UNIQUE INDEX "PlacementNote_tenantId_placementId_noteNumber_key"
  ON "reinsurance"."PlacementNote"("tenantId", "placementId", "noteNumber");

CREATE INDEX "PlacementNote_tenantId_placementId_status_createdAt_idx"
  ON "reinsurance"."PlacementNote"("tenantId", "placementId", "status", "createdAt");

CREATE INDEX "PlacementNote_tenantId_placementId_type_createdAt_idx"
  ON "reinsurance"."PlacementNote"("tenantId", "placementId", "type", "createdAt");

CREATE INDEX "PlacementNote_tenantId_closingId_status_idx"
  ON "reinsurance"."PlacementNote"("tenantId", "closingId", "status");

CREATE INDEX "PlacementNote_tenantId_participantId_createdAt_idx"
  ON "reinsurance"."PlacementNote"("tenantId", "participantId", "createdAt");

CREATE INDEX "PlacementNote_tenantId_counterpartyId_createdAt_idx"
  ON "reinsurance"."PlacementNote"("tenantId", "counterpartyId", "createdAt");

CREATE INDEX "PlacementNote_tenantId_settledByPaymentId_idx"
  ON "reinsurance"."PlacementNote"("tenantId", "settledByPaymentId");
