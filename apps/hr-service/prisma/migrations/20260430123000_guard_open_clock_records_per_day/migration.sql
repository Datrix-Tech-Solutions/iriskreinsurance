-- Ensure one active clock-in per employee per day.
CREATE UNIQUE INDEX IF NOT EXISTS "ClockRecord_single_open_record_per_day_idx"
ON "hr"."ClockRecord" ("tenantId", "employeeId", "date")
WHERE "clockOut" IS NULL;
