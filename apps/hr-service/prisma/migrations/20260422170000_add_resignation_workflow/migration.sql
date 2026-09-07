CREATE TYPE "hr"."ResignationReason" AS ENUM (
  'PERSONAL_REASONS',
  'BETTER_OPPORTUNITY',
  'RELOCATION',
  'FURTHER_EDUCATION',
  'HEALTH_REASONS',
  'OTHER'
);

CREATE TYPE "hr"."ResignationStatus" AS ENUM (
  'PENDING',
  'DISMISSED',
  'WITHDRAWN',
  'OFFBOARDING_INITIATED'
);

ALTER TABLE "hr"."TenantConfig"
  ADD COLUMN "adminUserId" TEXT,
  ADD COLUMN "resignationNoticePeriodDays" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "hr"."ResignationRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "lastWorkingDate" TIMESTAMP(3) NOT NULL,
  "reason" "hr"."ResignationReason",
  "additionalNotes" TEXT,
  "status" "hr"."ResignationStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "dismissedById" TEXT,
  "dismissedByEmail" TEXT,
  "offboardingInitiatedAt" TIMESTAMP(3),
  "offboardingRecordId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResignationRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResignationRecord_employeeId_key"
  ON "hr"."ResignationRecord"("employeeId");

ALTER TABLE "hr"."ResignationRecord"
  ADD CONSTRAINT "ResignationRecord_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "hr"."Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
