-- CreateTable
CREATE TABLE "reinsurance"."Currency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isoCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "exchangeRateToBase" DECIMAL(18,6),
    "isBaseCurrency" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "reinsurance"."Placement" ADD COLUMN "exchangeRateToBase" DECIMAL(18,6);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_id_tenantId_key" ON "reinsurance"."Currency"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_tenantId_isoCode_key" ON "reinsurance"."Currency"("tenantId", "isoCode");

-- CreateIndex
CREATE INDEX "Currency_tenantId_isActive_displayOrder_idx" ON "reinsurance"."Currency"("tenantId", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "Currency_tenantId_archivedAt_createdAt_idx" ON "reinsurance"."Currency"("tenantId", "archivedAt", "createdAt");
