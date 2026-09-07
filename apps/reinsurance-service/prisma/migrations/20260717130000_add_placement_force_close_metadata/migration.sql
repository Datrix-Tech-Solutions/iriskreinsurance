ALTER TABLE reinsurance."Placement"
  ADD COLUMN IF NOT EXISTS "closeMode" TEXT,
  ADD COLUMN IF NOT EXISTS "forceClosedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "forceClosedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Placement_tenantId_closeMode_idx"
  ON reinsurance."Placement"("tenantId", "closeMode");
