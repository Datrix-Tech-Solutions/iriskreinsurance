-- CreateEnum
CREATE TYPE "reinsurance"."BusinessClassFieldSection" AS ENUM ('BUSINESS_DETAILS', 'OFFER_DETAILS');

-- CreateEnum
CREATE TYPE "reinsurance"."BusinessClassFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'TEXTAREA');

-- AlterTable
ALTER TABLE "reinsurance"."Placement"
ADD COLUMN "businessDetails" JSONB,
ADD COLUMN "offerDetails" JSONB;

-- CreateTable
CREATE TABLE "reinsurance"."BusinessClass" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."BusinessClassField" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessClassId" TEXT NOT NULL,
  "section" "reinsurance"."BusinessClassFieldSection" NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "fieldType" "reinsurance"."BusinessClassFieldType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "validationRules" JSONB,
  "placeholder" TEXT,
  "helpText" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessClassField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessClass_id_tenantId_key" ON "reinsurance"."BusinessClass"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessClass_tenantId_code_key" ON "reinsurance"."BusinessClass"("tenantId", "code");

-- CreateIndex
CREATE INDEX "BusinessClass_tenantId_isActive_displayOrder_idx" ON "reinsurance"."BusinessClass"("tenantId", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "BusinessClass_tenantId_archivedAt_createdAt_idx" ON "reinsurance"."BusinessClass"("tenantId", "archivedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessClassField_tenantId_businessClassId_section_fieldKey_key" ON "reinsurance"."BusinessClassField"("tenantId", "businessClassId", "section", "fieldKey");

-- CreateIndex
CREATE INDEX "BusinessClassField_tenantId_businessClassId_section_isActive_idx" ON "reinsurance"."BusinessClassField"("tenantId", "businessClassId", "section", "isActive");

-- AddForeignKey
ALTER TABLE "reinsurance"."BusinessClassField" ADD CONSTRAINT "BusinessClassField_businessClassId_tenantId_fkey" FOREIGN KEY ("businessClassId", "tenantId") REFERENCES "reinsurance"."BusinessClass"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
