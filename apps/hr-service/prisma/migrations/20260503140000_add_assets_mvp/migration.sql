DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AssetType' AND n.nspname = 'hr'
  ) THEN
    CREATE TYPE hr."AssetType" AS ENUM (
      'LAPTOP',
      'PHONE',
      'TABLET',
      'PRINTER',
      'MONITOR',
      'VEHICLE',
      'FURNITURE',
      'SOFTWARE_LICENSE',
      'OTHER'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AssetStatus' AND n.nspname = 'hr'
  ) THEN
    CREATE TYPE hr."AssetStatus" AS ENUM (
      'AVAILABLE',
      'ASSIGNED',
      'MAINTENANCE',
      'RETIRED'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AssetCondition' AND n.nspname = 'hr'
  ) THEN
    CREATE TYPE hr."AssetCondition" AS ENUM (
      'NEW',
      'GOOD',
      'FAIR',
      'POOR'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS hr."Asset" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "assetNumber" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" hr."AssetType" NOT NULL,
  "serialNumber" TEXT,
  "purchaseDate" TIMESTAMP(3),
  "purchaseCost" DECIMAL(15,2),
  "currency" TEXT,
  "condition" hr."AssetCondition",
  "notes" TEXT,
  "status" hr."AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
  "assignedEmployeeId" TEXT,
  "assignedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS hr."AssetAssignment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "returnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Asset_tenantId_assetNumber_key"
ON hr."Asset"("tenantId", "assetNumber");

CREATE INDEX IF NOT EXISTS "Asset_tenantId_status_idx"
ON hr."Asset"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "Asset_tenantId_assignedEmployeeId_idx"
ON hr."Asset"("tenantId", "assignedEmployeeId");

CREATE INDEX IF NOT EXISTS "AssetAssignment_tenantId_employeeId_returnedAt_idx"
ON hr."AssetAssignment"("tenantId", "employeeId", "returnedAt");

CREATE INDEX IF NOT EXISTS "AssetAssignment_tenantId_assetId_returnedAt_idx"
ON hr."AssetAssignment"("tenantId", "assetId", "returnedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AssetAssignment_assetId_active_unique"
ON hr."AssetAssignment"("assetId")
WHERE "returnedAt" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Asset_assignedEmployeeId_fkey'
  ) THEN
    ALTER TABLE hr."Asset"
    ADD CONSTRAINT "Asset_assignedEmployeeId_fkey"
    FOREIGN KEY ("assignedEmployeeId") REFERENCES hr."Employee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AssetAssignment_assetId_fkey'
  ) THEN
    ALTER TABLE hr."AssetAssignment"
    ADD CONSTRAINT "AssetAssignment_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES hr."Asset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AssetAssignment_employeeId_fkey'
  ) THEN
    ALTER TABLE hr."AssetAssignment"
    ADD CONSTRAINT "AssetAssignment_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES hr."Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
