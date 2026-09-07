DO $$
BEGIN
  CREATE TYPE "reinsurance"."PlacementParticipantStatus" AS ENUM (
    'INVITED',
    'OFFER_SENT',
    'QUOTED',
    'ACCEPTED',
    'DECLINED',
    'CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "reinsurance"."PlacementParticipant"
  ADD COLUMN IF NOT EXISTS "status" "reinsurance"."PlacementParticipantStatus" NOT NULL DEFAULT 'INVITED';

CREATE INDEX IF NOT EXISTS "PlacementParticipant_tenantId_placementId_status_idx"
  ON "reinsurance"."PlacementParticipant"("tenantId", "placementId", "status");
