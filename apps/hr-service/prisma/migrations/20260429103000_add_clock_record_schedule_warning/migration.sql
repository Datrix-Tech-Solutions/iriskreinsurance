-- Persist whether the employee clocked in without an active schedule for the day
ALTER TABLE hr."ClockRecord"
ADD COLUMN IF NOT EXISTS "isOutsideSchedule" BOOLEAN NOT NULL DEFAULT false;
