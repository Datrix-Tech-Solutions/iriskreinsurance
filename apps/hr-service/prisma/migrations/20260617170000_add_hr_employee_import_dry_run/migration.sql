-- CreateEnum
CREATE TYPE "hr"."HrImportEntityType" AS ENUM ('EMPLOYEE');

-- CreateEnum
CREATE TYPE "hr"."HrImportJobStatus" AS ENUM ('DRY_RUN_COMPLETED', 'DRY_RUN_FAILED');

-- CreateEnum
CREATE TYPE "hr"."HrImportRowStatus" AS ENUM ('VALID', 'INVALID');

-- CreateTable
CREATE TABLE "hr"."HrImportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" "hr"."HrImportEntityType" NOT NULL,
    "status" "hr"."HrImportJobStatus" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."HrImportRow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "hr"."HrImportRowStatus" NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "errors" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HrImportJob_tenantId_entityType_idempotencyKey_key" ON "hr"."HrImportJob"("tenantId", "entityType", "idempotencyKey");

-- CreateIndex
CREATE INDEX "HrImportJob_tenantId_entityType_createdAt_idx" ON "hr"."HrImportJob"("tenantId", "entityType", "createdAt");

-- CreateIndex
CREATE INDEX "HrImportJob_tenantId_fileHash_idx" ON "hr"."HrImportJob"("tenantId", "fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "HrImportRow_jobId_rowNumber_key" ON "hr"."HrImportRow"("jobId", "rowNumber");

-- CreateIndex
CREATE INDEX "HrImportRow_tenantId_jobId_idx" ON "hr"."HrImportRow"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "HrImportRow_tenantId_status_idx" ON "hr"."HrImportRow"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "hr"."HrImportRow" ADD CONSTRAINT "HrImportRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "hr"."HrImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
