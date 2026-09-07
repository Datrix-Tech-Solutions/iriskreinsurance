-- CreateEnum
CREATE TYPE "reinsurance"."PlacementType" AS ENUM ('FACULTATIVE');

-- CreateEnum
CREATE TYPE "reinsurance"."PlacementStatus" AS ENUM ('DRAFT', 'MARKETING', 'QUOTED', 'BOUND', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "reinsurance"."PlacementParticipantRole" AS ENUM ('BROKER', 'REINSURER', 'LEAD_REINSURER', 'CO_REINSURER');

-- CreateTable
CREATE TABLE "reinsurance"."Placement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "normalizedReference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "placementType" "reinsurance"."PlacementType" NOT NULL DEFAULT 'FACULTATIVE',
  "status" "reinsurance"."PlacementStatus" NOT NULL DEFAULT 'DRAFT',
  "cedantId" TEXT NOT NULL,
  "classOfBusiness" TEXT,
  "description" TEXT,
  "inceptionDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "currency" TEXT,
  "sumInsured" DECIMAL(18,2),
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "archivedByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."PlacementParticipant" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "counterpartyId" TEXT NOT NULL,
  "role" "reinsurance"."PlacementParticipantRole" NOT NULL,
  "sharePercent" DECIMAL(7,4),
  "signedLinePercent" DECIMAL(7,4),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlacementParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."PlacementStatusHistory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "fromStatus" "reinsurance"."PlacementStatus",
  "toStatus" "reinsurance"."PlacementStatus" NOT NULL,
  "changedByUserId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlacementStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Placement_id_tenantId_key" ON "reinsurance"."Placement"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Placement_active_reference_key" ON "reinsurance"."Placement"("tenantId", "normalizedReference") WHERE "archivedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Placement_tenantId_placementType_archivedAt_idx" ON "reinsurance"."Placement"("tenantId", "placementType", "archivedAt");

-- CreateIndex
CREATE INDEX "Placement_tenantId_status_archivedAt_createdAt_idx" ON "reinsurance"."Placement"("tenantId", "status", "archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Placement_tenantId_cedantId_archivedAt_idx" ON "reinsurance"."Placement"("tenantId", "cedantId", "archivedAt");

-- CreateIndex
CREATE INDEX "Placement_tenantId_archivedAt_createdAt_idx" ON "reinsurance"."Placement"("tenantId", "archivedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementParticipant_tenantId_placementId_counterpartyId_role_key" ON "reinsurance"."PlacementParticipant"("tenantId", "placementId", "counterpartyId", "role");

-- CreateIndex
CREATE INDEX "PlacementParticipant_tenantId_placementId_idx" ON "reinsurance"."PlacementParticipant"("tenantId", "placementId");

-- CreateIndex
CREATE INDEX "PlacementParticipant_tenantId_counterpartyId_idx" ON "reinsurance"."PlacementParticipant"("tenantId", "counterpartyId");

-- CreateIndex
CREATE INDEX "PlacementStatusHistory_tenantId_placementId_createdAt_idx" ON "reinsurance"."PlacementStatusHistory"("tenantId", "placementId", "createdAt");

-- CreateIndex
CREATE INDEX "PlacementStatusHistory_tenantId_toStatus_createdAt_idx" ON "reinsurance"."PlacementStatusHistory"("tenantId", "toStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "reinsurance"."Placement" ADD CONSTRAINT "Placement_cedantId_tenantId_fkey" FOREIGN KEY ("cedantId", "tenantId") REFERENCES "reinsurance"."Counterparty"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reinsurance"."PlacementParticipant" ADD CONSTRAINT "PlacementParticipant_placementId_tenantId_fkey" FOREIGN KEY ("placementId", "tenantId") REFERENCES "reinsurance"."Placement"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reinsurance"."PlacementParticipant" ADD CONSTRAINT "PlacementParticipant_counterpartyId_tenantId_fkey" FOREIGN KEY ("counterpartyId", "tenantId") REFERENCES "reinsurance"."Counterparty"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reinsurance"."PlacementStatusHistory" ADD CONSTRAINT "PlacementStatusHistory_placementId_tenantId_fkey" FOREIGN KEY ("placementId", "tenantId") REFERENCES "reinsurance"."Placement"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
