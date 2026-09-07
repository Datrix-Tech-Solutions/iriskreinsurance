-- Add isLate flag to ClockRecord (computed at clock-in time)
ALTER TABLE hr."ClockRecord" ADD COLUMN IF NOT EXISTS "isLate" BOOLEAN NOT NULL DEFAULT false;

-- Add configurable late arrival threshold to TenantConfig (default 0 = no grace period)
ALTER TABLE hr."TenantConfig" ADD COLUMN IF NOT EXISTS "lateArrivalThresholdMinutes" INTEGER NOT NULL DEFAULT 0;
