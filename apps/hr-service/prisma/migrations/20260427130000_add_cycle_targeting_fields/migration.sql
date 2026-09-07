ALTER TABLE hr."AppraisalCycle"
  ADD COLUMN IF NOT EXISTS "employmentTypes" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "employeeIds"     TEXT[] NOT NULL DEFAULT '{}';
