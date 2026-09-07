-- Migration: rename BusinessClass -> RiskClass, add RiskType, rename BusinessClassField -> RiskTypeField.
-- Safe for fresh dev databases and for databases that already applied the previous
-- BusinessClass settings migration, whose physical table names were PascalCase.

-- Step 1: Create new enum types if this migration is retried after a partial failure.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'reinsurance'
          AND t.typname = 'RiskTypeFieldSection'
    ) THEN
        CREATE TYPE reinsurance."RiskTypeFieldSection" AS ENUM ('BUSINESS_DETAILS', 'OFFER_DETAILS');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'reinsurance'
          AND t.typname = 'RiskTypeFieldType'
    ) THEN
        CREATE TYPE reinsurance."RiskTypeFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'TEXTAREA');
    END IF;
END $$;

-- Step 2: Rename BusinessClass/business_class to risk_class.

DO $$
BEGIN
    IF to_regclass('reinsurance.risk_class') IS NULL THEN
        IF to_regclass('reinsurance."BusinessClass"') IS NOT NULL THEN
            ALTER TABLE reinsurance."BusinessClass" RENAME TO "risk_class";
        ELSIF to_regclass('reinsurance.business_class') IS NOT NULL THEN
            ALTER TABLE reinsurance."business_class" RENAME TO "risk_class";
        ELSE
            -- Defensive fallback for environments where the old settings table was
            -- not present but this migration is still being applied.
            CREATE TABLE reinsurance."risk_class" (
                "id" TEXT NOT NULL,
                "tenantId" TEXT NOT NULL,
                "name" TEXT NOT NULL,
                "description" TEXT,
                "isActive" BOOLEAN NOT NULL DEFAULT true,
                "displayOrder" INTEGER NOT NULL DEFAULT 0,
                "createdByUserId" TEXT NOT NULL,
                "updatedByUserId" TEXT NOT NULL,
                "archivedAt" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL,

                CONSTRAINT "risk_class_pkey" PRIMARY KEY ("id")
            );
        END IF;
    END IF;
END $$;

-- Drop old code column/indexes and apply the new uniqueness/index shape.
DROP INDEX IF EXISTS reinsurance."BusinessClass_tenantId_code_key";
DROP INDEX IF EXISTS reinsurance."business_class_tenantId_code_key";
ALTER TABLE reinsurance."risk_class" DROP CONSTRAINT IF EXISTS "business_class_tenantId_code_key";
ALTER TABLE reinsurance."risk_class" DROP COLUMN IF EXISTS "code";

ALTER INDEX IF EXISTS reinsurance."BusinessClass_tenantId_isActive_displayOrder_idx" RENAME TO "risk_class_tenantId_isActive_displayOrder_idx";
ALTER INDEX IF EXISTS reinsurance."business_class_tenantId_isActive_displayOrder_idx" RENAME TO "risk_class_tenantId_isActive_displayOrder_idx";
ALTER INDEX IF EXISTS reinsurance."BusinessClass_tenantId_archivedAt_createdAt_idx" RENAME TO "risk_class_tenantId_archivedAt_createdAt_idx";
ALTER INDEX IF EXISTS reinsurance."business_class_tenantId_archivedAt_createdAt_idx" RENAME TO "risk_class_tenantId_archivedAt_createdAt_idx";
ALTER INDEX IF EXISTS reinsurance."BusinessClass_id_tenantId_key" RENAME TO "risk_class_id_tenantId_key";
ALTER INDEX IF EXISTS reinsurance."business_class_id_tenantId_key" RENAME TO "risk_class_id_tenantId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "risk_class_id_tenantId_key"
    ON reinsurance."risk_class"("id", "tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "risk_class_tenantId_name_key"
    ON reinsurance."risk_class"("tenantId", "name");

CREATE INDEX IF NOT EXISTS "risk_class_tenantId_isActive_displayOrder_idx"
    ON reinsurance."risk_class"("tenantId", "isActive", "displayOrder");

CREATE INDEX IF NOT EXISTS "risk_class_tenantId_archivedAt_createdAt_idx"
    ON reinsurance."risk_class"("tenantId", "archivedAt", "createdAt");

-- Step 3: Create risk_type table.

CREATE TABLE IF NOT EXISTS reinsurance."risk_type" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "riskClassId"     TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "displayOrder"    INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "archivedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_type_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'risk_type_riskClassId_tenantId_fkey'
          AND conrelid = 'reinsurance.risk_type'::regclass
    ) THEN
        ALTER TABLE reinsurance."risk_type"
            ADD CONSTRAINT "risk_type_riskClassId_tenantId_fkey"
            FOREIGN KEY ("riskClassId", "tenantId")
            REFERENCES reinsurance."risk_class"("id", "tenantId")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "risk_type_id_tenantId_key"
    ON reinsurance."risk_type"("id", "tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "risk_type_tenantId_riskClassId_name_key"
    ON reinsurance."risk_type"("tenantId", "riskClassId", "name");
CREATE INDEX IF NOT EXISTS "risk_type_tenantId_riskClassId_isActive_displayOrder_idx"
    ON reinsurance."risk_type"("tenantId", "riskClassId", "isActive", "displayOrder");
CREATE INDEX IF NOT EXISTS "risk_type_tenantId_archivedAt_createdAt_idx"
    ON reinsurance."risk_type"("tenantId", "archivedAt", "createdAt");

-- Step 4: Rename BusinessClassField/business_class_field to risk_type_field.

DO $$
BEGIN
    IF to_regclass('reinsurance.risk_type_field') IS NULL THEN
        IF to_regclass('reinsurance."BusinessClassField"') IS NOT NULL THEN
            ALTER TABLE reinsurance."BusinessClassField" RENAME TO "risk_type_field";
        ELSIF to_regclass('reinsurance.business_class_field') IS NOT NULL THEN
            ALTER TABLE reinsurance."business_class_field" RENAME TO "risk_type_field";
        ELSE
            CREATE TABLE reinsurance."risk_type_field" (
                "id" TEXT NOT NULL,
                "tenantId" TEXT NOT NULL,
                "riskTypeId" TEXT NOT NULL,
                "section" reinsurance."RiskTypeFieldSection" NOT NULL,
                "fieldKey" TEXT NOT NULL,
                "label" TEXT NOT NULL,
                "fieldType" reinsurance."RiskTypeFieldType" NOT NULL,
                "required" BOOLEAN NOT NULL DEFAULT false,
                "options" JSONB,
                "validationRules" JSONB,
                "placeholder" TEXT,
                "helpText" TEXT,
                "displayOrder" INTEGER NOT NULL DEFAULT 0,
                "isActive" BOOLEAN NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL,

                CONSTRAINT "risk_type_field_pkey" PRIMARY KEY ("id")
            );
        END IF;
    END IF;
END $$;

ALTER TABLE reinsurance."risk_type_field" ADD COLUMN IF NOT EXISTS "riskTypeId" TEXT;

-- For each existing BusinessClassField row, create a default RiskType under the
-- matching RiskClass and point riskTypeId at it. Empty tables are a no-op.
DO $$
DECLARE
    rc RECORD;
    rt_id TEXT;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'reinsurance'
          AND table_name = 'risk_type_field'
          AND column_name = 'businessClassId'
    ) THEN
        FOR rc IN
            SELECT DISTINCT
                rc_inner.id,
                rc_inner."tenantId",
                rc_inner.name,
                rc_inner."createdByUserId",
                rc_inner."updatedByUserId"
            FROM reinsurance.risk_class rc_inner
            WHERE EXISTS (
                SELECT 1
                FROM reinsurance.risk_type_field f
                WHERE f."businessClassId" = rc_inner.id
                  AND f."tenantId" = rc_inner."tenantId"
            )
        LOOP
            INSERT INTO reinsurance.risk_type (
                id, "tenantId", "riskClassId", name,
                "isActive", "displayOrder",
                "createdByUserId", "updatedByUserId",
                "updatedAt"
            ) VALUES (
                md5(rc."tenantId" || ':' || rc.id || ':default-risk-type'), rc."tenantId", rc.id, rc.name,
                true, 0,
                rc."createdByUserId", rc."updatedByUserId",
                NOW()
            )
            ON CONFLICT ("tenantId", "riskClassId", name) DO NOTHING
            RETURNING id INTO rt_id;

            IF rt_id IS NULL THEN
                SELECT id INTO rt_id
                FROM reinsurance.risk_type
                WHERE "tenantId" = rc."tenantId"
                  AND "riskClassId" = rc.id
                  AND name = rc.name;
            END IF;

            UPDATE reinsurance.risk_type_field
            SET "riskTypeId" = rt_id
            WHERE "businessClassId" = rc.id
              AND "tenantId" = rc."tenantId";
        END LOOP;
    END IF;
END $$;

ALTER TABLE reinsurance."risk_type_field" ALTER COLUMN "riskTypeId" SET NOT NULL;

-- Drop old BusinessClassField FK/column/indexes.
ALTER TABLE reinsurance."risk_type_field" DROP CONSTRAINT IF EXISTS "BusinessClassField_businessClassId_tenantId_fkey";
ALTER TABLE reinsurance."risk_type_field" DROP CONSTRAINT IF EXISTS "business_class_field_businessClassId_tenantId_fkey";
DROP INDEX IF EXISTS reinsurance."BusinessClassField_tenantId_businessClassId_section_fieldKey_key";
DROP INDEX IF EXISTS reinsurance."business_class_field_tenantId_businessClassId_section_fieldKey_key";
DROP INDEX IF EXISTS reinsurance."BusinessClassField_tenantId_businessClassId_section_isActive_idx";
DROP INDEX IF EXISTS reinsurance."business_class_field_tenantId_businessClassId_section_isActive_idx";
ALTER TABLE reinsurance."risk_type_field" DROP COLUMN IF EXISTS "businessClassId";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'risk_type_field_riskTypeId_tenantId_fkey'
          AND conrelid = 'reinsurance.risk_type_field'::regclass
    ) THEN
        ALTER TABLE reinsurance."risk_type_field"
            ADD CONSTRAINT "risk_type_field_riskTypeId_tenantId_fkey"
            FOREIGN KEY ("riskTypeId", "tenantId")
            REFERENCES reinsurance."risk_type"("id", "tenantId")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE reinsurance."risk_type_field"
    ALTER COLUMN "section" TYPE reinsurance."RiskTypeFieldSection"
    USING "section"::text::reinsurance."RiskTypeFieldSection";

ALTER TABLE reinsurance."risk_type_field"
    ALTER COLUMN "fieldType" TYPE reinsurance."RiskTypeFieldType"
    USING "fieldType"::text::reinsurance."RiskTypeFieldType";

DROP TYPE IF EXISTS reinsurance."BusinessClassFieldSection";
DROP TYPE IF EXISTS reinsurance."BusinessClassFieldType";

CREATE UNIQUE INDEX IF NOT EXISTS "risk_type_field_tenantId_riskTypeId_section_fieldKey_key"
    ON reinsurance."risk_type_field"("tenantId", "riskTypeId", "section", "fieldKey");

CREATE INDEX IF NOT EXISTS "risk_type_field_tenantId_riskTypeId_section_isActive_idx"
    ON reinsurance."risk_type_field"("tenantId", "riskTypeId", "section", "isActive");

-- Step 5: Add new columns to Placement.

ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "riskTypeId"           TEXT;
ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "rate"                 DECIMAL(7,4);
ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "premium"              DECIMAL(18,2);
ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "commission"           DECIMAL(7,4);
ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "facultativeOffer"     DECIMAL(7,4);
ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "preliminaryBrokerage" DECIMAL(7,4);

CREATE INDEX IF NOT EXISTS "Placement_tenantId_riskTypeId_archivedAt_idx"
    ON reinsurance."Placement"("tenantId", "riskTypeId", "archivedAt");
