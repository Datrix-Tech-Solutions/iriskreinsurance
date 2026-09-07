-- Add PlacementClosingStatus enum and PlacementClosing table.
--
-- PlacementClosing is a first-class domain record that snapshots the financial
-- terms agreed with a reinsurer at the time a closing is issued. It can only
-- be created for ACCEPTED participants and its financial fields (grossPremium,
-- commissionAmount, brokerageAmount, netPremium) are immutable after creation
-- so that later participant or placement edits do not silently rewrite history.
--
-- A unique constraint on (id, tenantId) is also added to PlacementParticipant
-- so PlacementClosing can reference participants via a compound FK.

-- 1. New unique constraint on PlacementParticipant(id, tenantId)
CREATE UNIQUE INDEX "PlacementParticipant_id_tenantId_key"
  ON "reinsurance"."PlacementParticipant"("id", "tenantId");

-- 2. PlacementClosingStatus enum
CREATE TYPE "reinsurance"."PlacementClosingStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'CONFIRMED',
  'VOID'
);

-- 3. PlacementClosing table
CREATE TABLE "reinsurance"."PlacementClosing" (
  "id"                TEXT NOT NULL,
  "tenantId"          TEXT NOT NULL,
  "placementId"       TEXT NOT NULL,
  "participantId"     TEXT NOT NULL,
  "closingNumber"     TEXT NOT NULL,
  "status"            "reinsurance"."PlacementClosingStatus" NOT NULL DEFAULT 'DRAFT',
  "signedLinePercent" DECIMAL(7,4) NOT NULL,
  "sharePercent"      DECIMAL(7,4),
  "grossPremium"      DECIMAL(18,2),
  "commissionPercent" DECIMAL(7,4),
  "commissionAmount"  DECIMAL(18,2),
  "brokeragePercent"  DECIMAL(5,2),
  "brokerageAmount"   DECIMAL(18,2),
  "netPremium"        DECIMAL(18,2),
  "currency"          TEXT,
  "issuedAt"          TIMESTAMP(3),
  "confirmedAt"       TIMESTAMP(3),
  "createdByUserId"   TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlacementClosing_pkey" PRIMARY KEY ("id")
);

-- 4. Foreign keys
ALTER TABLE "reinsurance"."PlacementClosing"
  ADD CONSTRAINT "PlacementClosing_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES "reinsurance"."Placement"("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reinsurance"."PlacementClosing"
  ADD CONSTRAINT "PlacementClosing_participantId_tenantId_fkey"
  FOREIGN KEY ("participantId", "tenantId")
  REFERENCES "reinsurance"."PlacementParticipant"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Unique constraint: one closingNumber per placement per tenant
CREATE UNIQUE INDEX "PlacementClosing_tenantId_placementId_closingNumber_key"
  ON "reinsurance"."PlacementClosing"("tenantId", "placementId", "closingNumber");

-- 6. Performance indexes
CREATE INDEX "PlacementClosing_tenantId_placementId_idx"
  ON "reinsurance"."PlacementClosing"("tenantId", "placementId");

CREATE INDEX "PlacementClosing_tenantId_participantId_idx"
  ON "reinsurance"."PlacementClosing"("tenantId", "participantId");

CREATE INDEX "PlacementClosing_tenantId_placementId_status_idx"
  ON "reinsurance"."PlacementClosing"("tenantId", "placementId", "status");
