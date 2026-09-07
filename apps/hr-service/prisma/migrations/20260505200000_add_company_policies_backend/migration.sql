CREATE TYPE "hr"."AppraisalCycleRecipientGroup" AS ENUM (
  'ALL',
  'PERMANENT',
  'CONTRACTUAL',
  'PROBATION',
  'INTERNS'
);

CREATE TYPE "hr"."CompanyAgreementType" AS ENUM (
  'NDA',
  'EMPLOYMENT_CONTRACT',
  'CONFIDENTIALITY',
  'NON_COMPETE',
  'CODE_OF_CONDUCT',
  'IP_ASSIGNMENT',
  'PROBATION_AGREEMENT',
  'OTHER'
);

ALTER TABLE "hr"."TenantConfig"
ADD COLUMN "defaultProbationPeriodMonths" INTEGER,
ADD COLUMN "appraisalCycleRecipients" "hr"."AppraisalCycleRecipientGroup"[] NOT NULL DEFAULT ARRAY['ALL']::"hr"."AppraisalCycleRecipientGroup"[];

CREATE TABLE "hr"."CompanyAgreement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" "hr"."CompanyAgreementType" NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyAgreement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyAgreement_tenantId_createdAt_idx"
ON "hr"."CompanyAgreement"("tenantId", "createdAt");
