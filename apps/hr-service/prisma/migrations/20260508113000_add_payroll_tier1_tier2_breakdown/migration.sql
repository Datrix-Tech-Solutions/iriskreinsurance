ALTER TABLE "hr"."PayrollRun"
ADD COLUMN "totalTier1" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN "totalTier2" DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE "hr"."PayrollItem"
ADD COLUMN "tier1Contribution" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN "tier2Contribution" DECIMAL(15,2) NOT NULL DEFAULT 0;

UPDATE "hr"."PayrollItem"
SET
  "tier1Contribution" = ROUND(LEAST("basicSalary", 69000) * 0.005, 2),
  "tier2Contribution" = ROUND(LEAST("basicSalary", 69000) * 0.05, 2);

UPDATE "hr"."PayrollRun" run
SET
  "totalTier1" = COALESCE(items."totalTier1", 0),
  "totalTier2" = COALESCE(items."totalTier2", 0)
FROM (
  SELECT
    "payrollRunId",
    SUM("tier1Contribution") AS "totalTier1",
    SUM("tier2Contribution") AS "totalTier2"
  FROM "hr"."PayrollItem"
  GROUP BY "payrollRunId"
) items
WHERE run."id" = items."payrollRunId";
