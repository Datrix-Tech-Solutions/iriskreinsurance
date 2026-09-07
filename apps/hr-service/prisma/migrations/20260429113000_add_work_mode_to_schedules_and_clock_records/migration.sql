DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WorkMode' AND n.nspname = 'hr'
  ) THEN
    CREATE TYPE hr."WorkMode" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');
  END IF;
END $$;

ALTER TABLE hr."ShiftSchedule"
ADD COLUMN IF NOT EXISTS "workMode" hr."WorkMode" NOT NULL DEFAULT 'ONSITE';

ALTER TABLE hr."ClockRecord"
ADD COLUMN IF NOT EXISTS "workMode" hr."WorkMode";
