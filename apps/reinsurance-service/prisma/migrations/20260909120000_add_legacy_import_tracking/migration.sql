CREATE TABLE "reinsurance"."LegacyImportRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceFileHash" TEXT NOT NULL,
    "sourceFilePath" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyImportRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reinsurance"."LegacyImportMap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "legacyId" TEXT NOT NULL,
    "currentModel" TEXT NOT NULL,
    "currentId" TEXT NOT NULL,
    "rawHash" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "createdByImport" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyImportMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegacyImportMap_tenantId_sourceSystem_entityType_legacyId_key"
    ON "reinsurance"."LegacyImportMap"("tenantId", "sourceSystem", "entityType", "legacyId");

CREATE INDEX "LegacyImportRun_tenantId_sourceSystem_startedAt_idx"
    ON "reinsurance"."LegacyImportRun"("tenantId", "sourceSystem", "startedAt");

CREATE INDEX "LegacyImportRun_tenantId_status_idx"
    ON "reinsurance"."LegacyImportRun"("tenantId", "status");

CREATE INDEX "LegacyImportMap_tenantId_importRunId_idx"
    ON "reinsurance"."LegacyImportMap"("tenantId", "importRunId");

CREATE INDEX "LegacyImportMap_tenantId_currentModel_currentId_idx"
    ON "reinsurance"."LegacyImportMap"("tenantId", "currentModel", "currentId");

ALTER TABLE "reinsurance"."LegacyImportMap"
    ADD CONSTRAINT "LegacyImportMap_importRunId_fkey"
    FOREIGN KEY ("importRunId") REFERENCES "reinsurance"."LegacyImportRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
