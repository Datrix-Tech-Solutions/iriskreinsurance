-- Appraisal finalization, discrepancy resolution and redo workflow support.

ALTER TYPE "hr"."AppraisalStatus" ADD VALUE IF NOT EXISTS 'PENDING_FINALIZATION';

ALTER TABLE "hr"."Appraisal"
  ADD COLUMN IF NOT EXISTS "resolutionStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionBy" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalizedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalizationNote" TEXT,
  ADD COLUMN IF NOT EXISTS "reopenedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reopenedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reopenReason" TEXT,
  ADD COLUMN IF NOT EXISTS "revisionNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "hr"."TenantConfig"
  ADD COLUMN IF NOT EXISTS "appraisalDiscrepancyThreshold" INTEGER NOT NULL DEFAULT 20;

CREATE TABLE IF NOT EXISTS "hr"."AppraisalRevisionHistory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "appraisalId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "actorId" TEXT NOT NULL,
  "note" TEXT,
  "previousStatus" "hr"."AppraisalStatus",
  "previousSelfStatus" "hr"."ReviewStatus",
  "previousManagerStatus" "hr"."ReviewStatus",
  "previousSelfScore" DOUBLE PRECISION,
  "previousManagerScore" DOUBLE PRECISION,
  "previousFinalScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppraisalRevisionHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hr"."AppraisalResolutionAudit" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "appraisalId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "previousResolutionStatus" TEXT,
  "newResolutionStatus" TEXT,
  "previousFinalScore" DOUBLE PRECISION,
  "newFinalScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppraisalResolutionAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppraisalRevisionHistory_tenantId_appraisalId_idx"
  ON "hr"."AppraisalRevisionHistory"("tenantId", "appraisalId");

CREATE INDEX IF NOT EXISTS "AppraisalResolutionAudit_tenantId_appraisalId_idx"
  ON "hr"."AppraisalResolutionAudit"("tenantId", "appraisalId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AppraisalRevisionHistory_appraisalId_fkey'
  ) THEN
    ALTER TABLE "hr"."AppraisalRevisionHistory"
      ADD CONSTRAINT "AppraisalRevisionHistory_appraisalId_fkey"
      FOREIGN KEY ("appraisalId") REFERENCES "hr"."Appraisal"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AppraisalResolutionAudit_appraisalId_fkey'
  ) THEN
    ALTER TABLE "hr"."AppraisalResolutionAudit"
      ADD CONSTRAINT "AppraisalResolutionAudit_appraisalId_fkey"
      FOREIGN KEY ("appraisalId") REFERENCES "hr"."Appraisal"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
