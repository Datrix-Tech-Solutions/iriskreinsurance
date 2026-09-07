ALTER TABLE "hr"."PublicHoliday"
ADD COLUMN "observedDate" TIMESTAMP(3),
ADD COLUMN "countryScope" TEXT NOT NULL DEFAULT '',
ADD COLUMN "regionScope" TEXT NOT NULL DEFAULT '',
ADD COLUMN "isObservedShifted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "hr"."PublicHoliday"
SET "observedDate" = "date"
WHERE "observedDate" IS NULL;

ALTER TABLE "hr"."PublicHoliday"
ALTER COLUMN "observedDate" SET NOT NULL;

ALTER TABLE "hr"."PublicHoliday"
DROP CONSTRAINT IF EXISTS "PublicHoliday_tenantId_date_key";

ALTER TABLE "hr"."PublicHoliday"
ADD CONSTRAINT "PublicHoliday_tenantId_name_date_countryScope_regionScope_key"
UNIQUE ("tenantId", "name", "date", "countryScope", "regionScope");

CREATE INDEX IF NOT EXISTS "PublicHoliday_tenantId_observedDate_idx"
ON "hr"."PublicHoliday"("tenantId", "observedDate");

ALTER TABLE "hr"."LeaveRequest"
ADD COLUMN "coverageEmployeeId" TEXT,
ADD COLUMN "coverageNote" TEXT;

ALTER TABLE "hr"."LeaveRequest"
ADD CONSTRAINT "LeaveRequest_coverageEmployeeId_fkey"
FOREIGN KEY ("coverageEmployeeId") REFERENCES "hr"."Employee"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
