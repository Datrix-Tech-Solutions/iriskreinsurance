-- Remove the automatic appraisal discrepancy workflow.
-- This is intentionally safe for databases where the earlier discrepancy
-- objects were never created, and cleans up databases where they were.

DROP TABLE IF EXISTS "hr"."AppraisalResolutionAudit";

ALTER TABLE "hr"."Appraisal"
  DROP COLUMN IF EXISTS "resolutionStatus",
  DROP COLUMN IF EXISTS "resolutionNote",
  DROP COLUMN IF EXISTS "resolutionBy",
  DROP COLUMN IF EXISTS "resolutionAt";

ALTER TABLE "hr"."TenantConfig"
  DROP COLUMN IF EXISTS "appraisalDiscrepancyThreshold";
