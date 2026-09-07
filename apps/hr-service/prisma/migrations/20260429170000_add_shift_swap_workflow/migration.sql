DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ShiftSwapStatus' AND n.nspname = 'hr'
  ) THEN
    CREATE TYPE hr."ShiftSwapStatus" AS ENUM (
      'PENDING_COLLEAGUE',
      'PENDING_MANAGER',
      'APPROVED',
      'DECLINED',
      'REJECTED',
      'EXPIRED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS hr."ShiftSwapRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requesterEmployeeId" TEXT NOT NULL,
  "requesterScheduleId" TEXT NOT NULL,
  "requesterShiftDate" TIMESTAMP(3) NOT NULL,
  "targetEmployeeId" TEXT NOT NULL,
  "targetScheduleId" TEXT NOT NULL,
  "targetShiftDate" TIMESTAMP(3) NOT NULL,
  "managerEmployeeId" TEXT,
  "reason" TEXT,
  "status" hr."ShiftSwapStatus" NOT NULL DEFAULT 'PENDING_COLLEAGUE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "colleagueRespondedAt" TIMESTAMP(3),
  "managerDecisionAt" TIMESTAMP(3),
  "managerRejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShiftSwapRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS hr."ShiftAssignmentOverride" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "shiftDate" TIMESTAMP(3) NOT NULL,
  "assignedEmployeeId" TEXT NOT NULL,
  "swapRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShiftAssignmentOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShiftAssignmentOverride_scheduleId_shiftDate_key"
ON hr."ShiftAssignmentOverride"("scheduleId", "shiftDate");

CREATE INDEX IF NOT EXISTS "ShiftAssignmentOverride_tenantId_assignedEmployeeId_shiftDate_idx"
ON hr."ShiftAssignmentOverride"("tenantId", "assignedEmployeeId", "shiftDate");

CREATE INDEX IF NOT EXISTS "ShiftSwapRequest_tenantId_requesterEmployeeId_idx"
ON hr."ShiftSwapRequest"("tenantId", "requesterEmployeeId");

CREATE INDEX IF NOT EXISTS "ShiftSwapRequest_tenantId_targetEmployeeId_idx"
ON hr."ShiftSwapRequest"("tenantId", "targetEmployeeId");

CREATE INDEX IF NOT EXISTS "ShiftSwapRequest_tenantId_managerEmployeeId_status_idx"
ON hr."ShiftSwapRequest"("tenantId", "managerEmployeeId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftSwapRequest_requesterEmployeeId_fkey'
  ) THEN
    ALTER TABLE hr."ShiftSwapRequest"
    ADD CONSTRAINT "ShiftSwapRequest_requesterEmployeeId_fkey"
    FOREIGN KEY ("requesterEmployeeId") REFERENCES hr."Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftSwapRequest_requesterScheduleId_fkey'
  ) THEN
    ALTER TABLE hr."ShiftSwapRequest"
    ADD CONSTRAINT "ShiftSwapRequest_requesterScheduleId_fkey"
    FOREIGN KEY ("requesterScheduleId") REFERENCES hr."ShiftSchedule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftSwapRequest_targetEmployeeId_fkey'
  ) THEN
    ALTER TABLE hr."ShiftSwapRequest"
    ADD CONSTRAINT "ShiftSwapRequest_targetEmployeeId_fkey"
    FOREIGN KEY ("targetEmployeeId") REFERENCES hr."Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftSwapRequest_targetScheduleId_fkey'
  ) THEN
    ALTER TABLE hr."ShiftSwapRequest"
    ADD CONSTRAINT "ShiftSwapRequest_targetScheduleId_fkey"
    FOREIGN KEY ("targetScheduleId") REFERENCES hr."ShiftSchedule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftSwapRequest_managerEmployeeId_fkey'
  ) THEN
    ALTER TABLE hr."ShiftSwapRequest"
    ADD CONSTRAINT "ShiftSwapRequest_managerEmployeeId_fkey"
    FOREIGN KEY ("managerEmployeeId") REFERENCES hr."Employee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftAssignmentOverride_scheduleId_fkey'
  ) THEN
    ALTER TABLE hr."ShiftAssignmentOverride"
    ADD CONSTRAINT "ShiftAssignmentOverride_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES hr."ShiftSchedule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftAssignmentOverride_assignedEmployeeId_fkey'
  ) THEN
    ALTER TABLE hr."ShiftAssignmentOverride"
    ADD CONSTRAINT "ShiftAssignmentOverride_assignedEmployeeId_fkey"
    FOREIGN KEY ("assignedEmployeeId") REFERENCES hr."Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShiftAssignmentOverride_swapRequestId_fkey'
  ) THEN
    ALTER TABLE hr."ShiftAssignmentOverride"
    ADD CONSTRAINT "ShiftAssignmentOverride_swapRequestId_fkey"
    FOREIGN KEY ("swapRequestId") REFERENCES hr."ShiftSwapRequest"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
