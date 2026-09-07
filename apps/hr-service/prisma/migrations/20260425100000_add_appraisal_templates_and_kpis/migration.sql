-- Create AppraisalTemplate table
CREATE TABLE IF NOT EXISTS hr."AppraisalTemplate" (
  "id"                      TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"                TEXT NOT NULL,
  "name"                    TEXT NOT NULL,
  "selfAssessmentWeight"    INTEGER NOT NULL DEFAULT 50,
  "managerAssessmentWeight" INTEGER NOT NULL DEFAULT 50,
  "isActive"                BOOLEAN NOT NULL DEFAULT true,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppraisalTemplate_pkey" PRIMARY KEY ("id")
);

-- Create AppraisalTemplateKpi table
CREATE TABLE IF NOT EXISTS hr."AppraisalTemplateKpi" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "templateId"  TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "weight"      INTEGER NOT NULL,
  "maxScore"    INTEGER NOT NULL DEFAULT 5,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppraisalTemplateKpi_pkey" PRIMARY KEY ("id")
);

-- Create AppraisalKpi table (cycle-specific KPIs)
CREATE TABLE IF NOT EXISTS hr."AppraisalKpi" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,
  "cycleId"       TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "weight"        INTEGER NOT NULL,
  "maxScore"      INTEGER NOT NULL DEFAULT 5,
  "selfWeight"    INTEGER NOT NULL DEFAULT 50,
  "managerWeight" INTEGER NOT NULL DEFAULT 50,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppraisalKpi_pkey" PRIMARY KEY ("id")
);

-- Add new columns to AppraisalCycle
ALTER TABLE hr."AppraisalCycle"
  ADD COLUMN IF NOT EXISTS "selfAssessmentDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "managerReviewDeadline"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "frequency"              TEXT,
  ADD COLUMN IF NOT EXISTS "departmentIds"          TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "templateId"             TEXT;

-- Foreign keys
ALTER TABLE hr."AppraisalTemplateKpi"
  ADD CONSTRAINT "AppraisalTemplateKpi_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES hr."AppraisalTemplate"("id") ON DELETE CASCADE;

ALTER TABLE hr."AppraisalKpi"
  ADD CONSTRAINT "AppraisalKpi_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES hr."AppraisalCycle"("id") ON DELETE CASCADE;

ALTER TABLE hr."AppraisalCycle"
  ADD CONSTRAINT "AppraisalCycle_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES hr."AppraisalTemplate"("id") ON DELETE SET NULL;
