-- Classify endorsement business impact for frontend workflow routing.
CREATE TYPE reinsurance."PlacementEndorsementImpactType" AS ENUM (
  'CAPACITY_INCREASE',
  'TERMS_ONLY',
  'DECREASE_OR_CANCELLATION',
  'ADMINISTRATIVE'
);

ALTER TABLE reinsurance."PlacementEndorsement"
  ADD COLUMN "impactType" reinsurance."PlacementEndorsementImpactType" NOT NULL DEFAULT 'ADMINISTRATIVE';

-- Conservative historical backfill: older endorsements did not store impactType.
-- Avoid JSON snapshot parsing here because legacy snapshot shapes can vary.
-- Future creates/updates derive the precise impact in application code.
UPDATE reinsurance."PlacementEndorsement"
SET "impactType" = 'CAPACITY_INCREASE'
WHERE "targetPercent" IS NOT NULL
  AND "targetPercent" > 0;
