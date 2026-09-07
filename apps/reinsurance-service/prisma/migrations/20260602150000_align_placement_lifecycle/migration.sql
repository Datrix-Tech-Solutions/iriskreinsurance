-- Align placement lifecycle with broker facultative workflow.
--
-- Dev data audit from this workstation could not reach the local/dev database
-- because the available local env points to localhost:5432 and no database was
-- running. To avoid relying on assumptions for legacy QUOTED rows, this
-- migration recalculates them from accepted participant capacity where
-- possible. Legacy BOUND rows are mapped to CLOSED to preserve the previous
-- terminal/non-editable behavior.
--
-- The migration stages target enum values in temporary text columns before
-- rebuilding the enum. That avoids using newly added enum labels in the same
-- transaction.

ALTER TABLE "reinsurance"."Placement"
  ADD COLUMN "_status_next" text;

WITH placement_capacity AS (
  SELECT
    p.id,
    p."tenantId",
    COALESCE(NULLIF(p."facultativeOffer"::numeric, 0), 100) AS target_percent,
    COALESCE(
      SUM(
        CASE
          WHEN pp.status::text = 'ACCEPTED'
          THEN COALESCE(pp."signedLinePercent"::numeric, 0)
          ELSE 0
        END
      ),
      0
    ) AS accepted_percent
  FROM "reinsurance"."Placement" p
  LEFT JOIN "reinsurance"."PlacementParticipant" pp
    ON pp."tenantId" = p."tenantId"
   AND pp."placementId" = p.id
  GROUP BY p.id, p."tenantId", p."facultativeOffer"
)
UPDATE "reinsurance"."Placement" p
SET "_status_next" = CASE
  WHEN p.status::text = 'BOUND' THEN 'CLOSED'
  WHEN p.status::text = 'QUOTED' AND pc.accepted_percent >= pc.target_percent THEN 'PLACED'
  WHEN p.status::text = 'QUOTED' AND pc.accepted_percent > 0 THEN 'PARTIALLY_PLACED'
  WHEN p.status::text = 'QUOTED' THEN 'MARKETING'
  ELSE p.status::text
END
FROM placement_capacity pc
WHERE p.id = pc.id
  AND p."tenantId" = pc."tenantId";

ALTER TABLE "reinsurance"."PlacementStatusHistory"
  ADD COLUMN "_fromStatus_next" text,
  ADD COLUMN "_toStatus_next" text;

UPDATE "reinsurance"."PlacementStatusHistory"
SET
  "_fromStatus_next" = CASE
    WHEN "fromStatus" IS NULL THEN NULL
    WHEN "fromStatus"::text = 'BOUND' THEN 'CLOSED'
    WHEN "fromStatus"::text = 'QUOTED' THEN 'MARKETING'
    ELSE "fromStatus"::text
  END,
  "_toStatus_next" = CASE
    WHEN "toStatus"::text = 'BOUND' THEN 'CLOSED'
    WHEN "toStatus"::text = 'QUOTED' THEN 'MARKETING'
    ELSE "toStatus"::text
  END;

ALTER TABLE "reinsurance"."Placement"
  ALTER COLUMN status DROP DEFAULT;

ALTER TYPE "reinsurance"."PlacementStatus" RENAME TO "PlacementStatus_old";

CREATE TYPE "reinsurance"."PlacementStatus" AS ENUM (
  'DRAFT',
  'MARKETING',
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED'
);

ALTER TABLE "reinsurance"."Placement"
  ALTER COLUMN status TYPE "reinsurance"."PlacementStatus"
  USING "_status_next"::"reinsurance"."PlacementStatus";

ALTER TABLE "reinsurance"."PlacementStatusHistory"
  ALTER COLUMN "fromStatus" TYPE "reinsurance"."PlacementStatus"
  USING "_fromStatus_next"::"reinsurance"."PlacementStatus";

ALTER TABLE "reinsurance"."PlacementStatusHistory"
  ALTER COLUMN "toStatus" TYPE "reinsurance"."PlacementStatus"
  USING "_toStatus_next"::"reinsurance"."PlacementStatus";

ALTER TABLE "reinsurance"."Placement"
  ALTER COLUMN status SET DEFAULT 'DRAFT';

ALTER TABLE "reinsurance"."Placement"
  DROP COLUMN "_status_next";

ALTER TABLE "reinsurance"."PlacementStatusHistory"
  DROP COLUMN "_fromStatus_next",
  DROP COLUMN "_toStatus_next";

DROP TYPE "reinsurance"."PlacementStatus_old";
