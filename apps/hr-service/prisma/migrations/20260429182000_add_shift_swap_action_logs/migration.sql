DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ShiftSwapActionType' AND n.nspname = 'hr'
  ) THEN
    CREATE TYPE hr."ShiftSwapActionType" AS ENUM (
      'REQUESTED',
      'COLLEAGUE_ACCEPTED',
      'COLLEAGUE_DECLINED',
      'MANAGER_APPROVED',
      'MANAGER_REJECTED',
      'EXPIRED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS hr."ShiftSwapActionLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "shiftSwapRequestId" TEXT NOT NULL,
  "action" hr."ShiftSwapActionType" NOT NULL,
  "actorEmployeeId" TEXT,
  "actorUserId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShiftSwapActionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShiftSwapActionLog_tenantId_shiftSwapRequestId_createdAt_idx"
ON hr."ShiftSwapActionLog"("tenantId", "shiftSwapRequestId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftSwapActionLog_shiftSwapRequestId_fkey'
  ) THEN
    ALTER TABLE hr."ShiftSwapActionLog"
    ADD CONSTRAINT "ShiftSwapActionLog_shiftSwapRequestId_fkey"
    FOREIGN KEY ("shiftSwapRequestId") REFERENCES hr."ShiftSwapRequest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftSwapActionLog_actorEmployeeId_fkey'
  ) THEN
    ALTER TABLE hr."ShiftSwapActionLog"
    ADD CONSTRAINT "ShiftSwapActionLog_actorEmployeeId_fkey"
    FOREIGN KEY ("actorEmployeeId") REFERENCES hr."Employee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
