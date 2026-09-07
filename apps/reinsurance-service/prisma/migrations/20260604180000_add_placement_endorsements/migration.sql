-- CreateEnum
CREATE TYPE reinsurance."PlacementEndorsementType" AS ENUM (
  'SUM_INSURED_INCREASE',
  'SUM_INSURED_DECREASE',
  'PREMIUM_ADJUSTMENT',
  'COVERAGE_AMENDMENT',
  'POLICY_AMENDMENT',
  'PARTICIPANT_SHARE_CHANGE',
  'PARTICIPANT_ADDITION',
  'PARTICIPANT_REMOVAL',
  'CANCELLATION',
  'OTHER'
);

-- CreateEnum
CREATE TYPE reinsurance."PlacementEndorsementStatus" AS ENUM (
  'DRAFT',
  'MARKETING',
  'PARTIALLY_ACCEPTED',
  'ACCEPTED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'VOID'
);

-- CreateTable
CREATE TABLE reinsurance."PlacementEndorsement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "endorsementNumber" TEXT NOT NULL,
  "type" reinsurance."PlacementEndorsementType" NOT NULL,
  "status" reinsurance."PlacementEndorsementStatus" NOT NULL DEFAULT 'DRAFT',
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "description" TEXT,
  "changeSummary" JSONB,
  "originalSnapshot" JSONB NOT NULL,
  "proposedSnapshot" JSONB,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlacementEndorsement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlacementEndorsement_id_tenantId_key"
  ON reinsurance."PlacementEndorsement"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementEndorsement_tenantId_placementId_endorsementNumber_key"
  ON reinsurance."PlacementEndorsement"("tenantId", "placementId", "endorsementNumber");

-- CreateIndex
CREATE INDEX "PlacementEndorsement_tenantId_placementId_status_createdAt_idx"
  ON reinsurance."PlacementEndorsement"("tenantId", "placementId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PlacementEndorsement_tenantId_placementId_type_createdAt_idx"
  ON reinsurance."PlacementEndorsement"("tenantId", "placementId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "PlacementEndorsement_tenantId_status_createdAt_idx"
  ON reinsurance."PlacementEndorsement"("tenantId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE reinsurance."PlacementEndorsement"
  ADD CONSTRAINT "PlacementEndorsement_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES reinsurance."Placement"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
