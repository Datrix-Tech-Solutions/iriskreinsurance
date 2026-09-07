CREATE TABLE IF NOT EXISTS "w_auth"."TenantBranding" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "logoObjectKey" TEXT,
  "logoDisplayUrl" TEXT,
  "faviconObjectKey" TEXT,
  "faviconDisplayUrl" TEXT,
  "primaryColor" TEXT,
  "secondaryColor" TEXT,
  "accentColor" TEXT,
  "sidebarColor" TEXT,
  "emailHeaderColor" TEXT,
  "documentHeaderColor" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantBranding_tenantId_key"
  ON "w_auth"."TenantBranding"("tenantId");

CREATE INDEX IF NOT EXISTS "TenantBranding_tenantId_idx"
  ON "w_auth"."TenantBranding"("tenantId");

CREATE INDEX IF NOT EXISTS "TenantBranding_updatedByUserId_idx"
  ON "w_auth"."TenantBranding"("updatedByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantBranding_tenantId_fkey'
      AND connamespace = 'w_auth'::regnamespace
  ) THEN
    ALTER TABLE "w_auth"."TenantBranding"
      ADD CONSTRAINT "TenantBranding_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "w_auth"."Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantBranding_updatedByUserId_fkey'
      AND connamespace = 'w_auth'::regnamespace
  ) THEN
    ALTER TABLE "w_auth"."TenantBranding"
      ADD CONSTRAINT "TenantBranding_updatedByUserId_fkey"
      FOREIGN KEY ("updatedByUserId") REFERENCES "w_auth"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
