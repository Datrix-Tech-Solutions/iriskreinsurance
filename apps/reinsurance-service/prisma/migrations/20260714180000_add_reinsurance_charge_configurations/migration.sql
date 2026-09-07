-- CreateEnum
CREATE TYPE "reinsurance"."ReinsuranceChargeCode" AS ENUM ('NIC_LEVY', 'WITHHOLDING_TAX');

-- CreateEnum
CREATE TYPE "reinsurance"."ReinsuranceChargeType" AS ENUM ('TAX', 'LEVY', 'FEE', 'DUTY', 'OTHER');

-- CreateEnum
CREATE TYPE "reinsurance"."ReinsuranceChargeRateType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "reinsurance"."ReinsuranceChargeCalculationBasis" AS ENUM ('GROSS_AMOUNT', 'COMMISSION_AMOUNT', 'BROKERAGE_AMOUNT', 'NET_BEFORE_CHARGES');

-- CreateEnum
CREATE TYPE "reinsurance"."ReinsuranceChargeDirection" AS ENUM ('ADDITION', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "reinsurance"."ReinsuranceChargeRoundingMode" AS ENUM ('HALF_UP', 'UP', 'DOWN');

-- AlterTable
ALTER TABLE "reinsurance"."PlacementNote"
ADD COLUMN "appliedCharges" JSONB;

-- CreateTable
CREATE TABLE "reinsurance"."ReinsuranceChargeConfiguration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" "reinsurance"."ReinsuranceChargeCode" NOT NULL,
    "name" TEXT NOT NULL,
    "chargeType" "reinsurance"."ReinsuranceChargeType" NOT NULL,
    "rateType" "reinsurance"."ReinsuranceChargeRateType" NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "calculationBasis" "reinsurance"."ReinsuranceChargeCalculationBasis" NOT NULL,
    "direction" "reinsurance"."ReinsuranceChargeDirection" NOT NULL,
    "currency" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "roundingMode" "reinsurance"."ReinsuranceChargeRoundingMode" NOT NULL DEFAULT 'HALF_UP',
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReinsuranceChargeConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReinsuranceChargeConfiguration_id_tenantId_key" ON "reinsurance"."ReinsuranceChargeConfiguration"("id", "tenantId");

-- CreateIndex
CREATE INDEX "ReinsuranceChargeConfiguration_tenantId_code_currency_effectiveFrom_effectiveTo_idx" ON "reinsurance"."ReinsuranceChargeConfiguration"("tenantId", "code", "currency", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "ReinsuranceChargeConfiguration_tenantId_isEnabled_displayOrder_idx" ON "reinsurance"."ReinsuranceChargeConfiguration"("tenantId", "isEnabled", "displayOrder");
