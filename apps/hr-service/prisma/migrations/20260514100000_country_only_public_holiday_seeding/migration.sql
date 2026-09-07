-- Collapse previously region-scoped system holidays into one country-wide row.
-- Manual holidays are left intact, except conflicting regional system rows are
-- removed when a country-wide row already exists for the same tenant/name/date.

DELETE FROM "hr"."PublicHoliday" AS regional
USING "hr"."PublicHoliday" AS country_wide
WHERE regional."source" LIKE 'SYSTEM_%'
  AND regional."regionScope" <> ''
  AND country_wide."tenantId" = regional."tenantId"
  AND country_wide."name" = regional."name"
  AND country_wide."date" = regional."date"
  AND country_wide."countryScope" = regional."countryScope"
  AND country_wide."regionScope" = '';

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "name", "date", "countryScope"
      ORDER BY "observedDate", "createdAt", "id"
    ) AS rn
  FROM "hr"."PublicHoliday"
  WHERE "source" LIKE 'SYSTEM_%'
    AND "regionScope" <> ''
)
DELETE FROM "hr"."PublicHoliday" AS holiday
USING ranked
WHERE holiday."id" = ranked."id"
  AND ranked.rn > 1;

UPDATE "hr"."PublicHoliday"
SET "regionScope" = ''
WHERE "source" LIKE 'SYSTEM_%'
  AND "regionScope" <> '';

DELETE FROM "hr"."PublicHoliday" AS manual
USING "hr"."PublicHoliday" AS system_holiday
WHERE manual."source" = 'MANUAL'
  AND system_holiday."source" LIKE 'SYSTEM_%'
  AND manual."tenantId" = system_holiday."tenantId"
  AND manual."name" = system_holiday."name"
  AND manual."date" = system_holiday."date";
