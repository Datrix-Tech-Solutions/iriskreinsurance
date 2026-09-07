-- Create AppraisalKpiScore table
CREATE TABLE IF NOT EXISTS hr."AppraisalKpiScore" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "appraisalId" TEXT NOT NULL,
  "kpiId"       TEXT NOT NULL,
  "reviewType"  TEXT NOT NULL,
  "score"       INTEGER NOT NULL,
  "comment"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppraisalKpiScore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AppraisalKpiScore_appraisalId_kpiId_reviewType_key" UNIQUE ("appraisalId", "kpiId", "reviewType")
);

-- Foreign keys
ALTER TABLE hr."AppraisalKpiScore"
  ADD CONSTRAINT "AppraisalKpiScore_appraisalId_fkey"
  FOREIGN KEY ("appraisalId") REFERENCES hr."Appraisal"("id") ON DELETE CASCADE;

ALTER TABLE hr."AppraisalKpiScore"
  ADD CONSTRAINT "AppraisalKpiScore_kpiId_fkey"
  FOREIGN KEY ("kpiId") REFERENCES hr."AppraisalKpi"("id") ON DELETE CASCADE;
