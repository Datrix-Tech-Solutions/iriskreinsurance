ALTER TABLE hr."TenantConfig"
ADD COLUMN IF NOT EXISTS "appraisalEligibleStatuses" hr."EmploymentStatus"[] NOT NULL DEFAULT ARRAY['ACTIVE', 'PROBATION']::hr."EmploymentStatus"[];

ALTER TABLE hr."AppraisalCycle"
ADD COLUMN IF NOT EXISTS "employmentStatuses" hr."EmploymentStatus"[] NOT NULL DEFAULT ARRAY[]::hr."EmploymentStatus"[];
