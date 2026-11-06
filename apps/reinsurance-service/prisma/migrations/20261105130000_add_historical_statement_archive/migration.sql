-- CreateEnum
CREATE TYPE "reinsurance"."HistoricalStatementLoadStatus" AS ENUM ('STAGING', 'READY', 'PUBLISHED', 'SUPERSEDED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "reinsurance"."HistoricalStatementKind" AS ENUM ('INSURER', 'REINSURER');

-- CreateEnum
CREATE TYPE "reinsurance"."HistoricalStatementLinkBasis" AS ENUM ('SUPPLIED_AUTHORITATIVE', 'APPROVED_CANDIDATE');

-- CreateTable
CREATE TABLE "reinsurance"."historical_statement_load" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "datasetKey" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "contentManifestSha256" TEXT NOT NULL,
    "matchManifestSha256" TEXT,
    "contractVersion" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "loaderVersion" TEXT NOT NULL,
    "status" "reinsurance"."HistoricalStatementLoadStatus" NOT NULL DEFAULT 'STAGING',
    "sourceManifest" JSONB NOT NULL,
    "validationSummary" JSONB NOT NULL,
    "progress" JSONB NOT NULL,
    "lifecycleEvents" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "rolledBackByUserId" TEXT,
    "publicationApprovalRef" TEXT,
    "rollbackReason" TEXT,
    "supersededByLoadId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "errorSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_statement_load_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."historical_statement_file" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "kind" "reinsurance"."HistoricalStatementKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "sheetXmlPath" TEXT NOT NULL,
    "headerSha256" TEXT NOT NULL,
    "headerCells" JSONB NOT NULL,
    "workbookMetadata" JSONB NOT NULL,
    "physicalRowCount" INTEGER NOT NULL,
    "businessRowCount" INTEGER NOT NULL,
    "sourceColumnCount" INTEGER NOT NULL,
    "rawStorageProvider" TEXT NOT NULL,
    "rawStorageKey" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historical_statement_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."historical_insurer_statement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "rowSha256" TEXT NOT NULL,
    "rawCells" JSONB NOT NULL,
    "qualityFlags" JSONB NOT NULL,
    "policySearch" TEXT NOT NULL,
    "insuredSearch" TEXT NOT NULL,
    "businessSearch" TEXT NOT NULL,
    "counterpartySearch" TEXT NOT NULL,
    "reinsuredSearch" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "policyNumber" TEXT,
    "insurerName" TEXT,
    "insuredName" TEXT,
    "businessName" TEXT,
    "offerDate" DATE,
    "closedDate" DATE,
    "startDate" DATE,
    "endDate" DATE,
    "currency" TEXT,
    "sumInsured100" DECIMAL(30,12),
    "premium100" DECIMAL(30,12),
    "facShare" DECIMAL(30,12),
    "facSumInsured" DECIMAL(30,12),
    "facPremium" DECIMAL(30,12),
    "paidFacPremium" DECIMAL(30,12),
    "insurerCommissionPercent" DECIMAL(30,12),
    "paidCommission" DECIMAL(30,12),
    "netPremiumDueBroker" DECIMAL(30,12),
    "netPremiumDueBrokerPaid" DECIMAL(30,12),
    "brokerage" DECIMAL(30,12),
    "brokeragePaid" DECIMAL(30,12),
    "wht" DECIMAL(30,12),
    "paidWht" DECIMAL(30,12),
    "nicLevy" DECIMAL(30,12),
    "paidNic" DECIMAL(30,12),
    "netPremiumDueReinsurer" DECIMAL(30,12),
    "netPremiumPaid" DECIMAL(30,12),
    "offerStatus" TEXT,
    "paymentStatus" TEXT,
    "matchId" TEXT,

    CONSTRAINT "historical_insurer_statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."historical_reinsurer_statement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "rowSha256" TEXT NOT NULL,
    "rawCells" JSONB NOT NULL,
    "qualityFlags" JSONB NOT NULL,
    "policySearch" TEXT NOT NULL,
    "insuredSearch" TEXT NOT NULL,
    "businessSearch" TEXT NOT NULL,
    "counterpartySearch" TEXT NOT NULL,
    "reinsuredSearch" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "policyNumber" TEXT,
    "reinsurerName" TEXT,
    "insuredName" TEXT,
    "businessName" TEXT,
    "reinsuredName" TEXT,
    "offerDate" DATE,
    "closedDate" DATE,
    "startDate" DATE,
    "endDate" DATE,
    "currency" TEXT,
    "sumInsured100" DECIMAL(30,12),
    "premium100" DECIMAL(30,12),
    "facShare" DECIMAL(30,12),
    "facSumInsured" DECIMAL(30,12),
    "facPremium" DECIMAL(30,12),
    "paidFacPremium" DECIMAL(30,12),
    "insurerCommissionAmount" DECIMAL(30,12),
    "paidCommission" DECIMAL(30,12),
    "brokerage" DECIMAL(30,12),
    "brokeragePaid" DECIMAL(30,12),
    "wht" DECIMAL(30,12),
    "paidWhtFirst" DECIMAL(30,12),
    "paidWhtSecond" DECIMAL(30,12),
    "nicLevy" DECIMAL(30,12),
    "paidNic" DECIMAL(30,12),
    "netPremiumDueReinsurer" DECIMAL(30,12),
    "netPremiumPaid" DECIMAL(30,12),
    "offerStatus" TEXT,
    "paymentStatus" TEXT,

    CONSTRAINT "historical_reinsurer_statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."historical_statement_link" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "insurerRowId" TEXT NOT NULL,
    "reinsurerRowId" TEXT NOT NULL,
    "basis" "reinsurance"."HistoricalStatementLinkBasis" NOT NULL,
    "approvalRef" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "evidenceSha256" TEXT NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historical_statement_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historical_statement_load_tenantId_datasetKey_status_create_idx" ON "reinsurance"."historical_statement_load"("tenantId", "datasetKey", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "historical_statement_load_tenantId_id_key" ON "reinsurance"."historical_statement_load"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "historical_statement_load_tenantId_datasetKey_datasetVersio_key" ON "reinsurance"."historical_statement_load"("tenantId", "datasetKey", "datasetVersion");

-- CreateIndex
CREATE UNIQUE INDEX "historical_statement_load_tenantId_datasetKey_contentManife_key" ON "reinsurance"."historical_statement_load"("tenantId", "datasetKey", "contentManifestSha256");

-- CreateIndex
CREATE INDEX "historical_statement_file_tenantId_loadId_kind_year_idx" ON "reinsurance"."historical_statement_file"("tenantId", "loadId", "kind", "year");

-- CreateIndex
CREATE UNIQUE INDEX "historical_statement_file_tenantId_loadId_id_year_key" ON "reinsurance"."historical_statement_file"("tenantId", "loadId", "id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "historical_statement_file_tenantId_loadId_kind_year_sheetNa_key" ON "reinsurance"."historical_statement_file"("tenantId", "loadId", "kind", "year", "sheetName");

-- CreateIndex
CREATE UNIQUE INDEX "historical_statement_file_tenantId_loadId_sha256_sheetName_key" ON "reinsurance"."historical_statement_file"("tenantId", "loadId", "sha256", "sheetName");

-- CreateIndex
CREATE INDEX "historical_insurer_statement_tenantId_loadId_year_id_idx" ON "reinsurance"."historical_insurer_statement"("tenantId", "loadId", "year", "id");

-- CreateIndex
CREATE INDEX "historical_insurer_statement_tenantId_loadId_policySearch_i_idx" ON "reinsurance"."historical_insurer_statement"("tenantId", "loadId", "policySearch", "id");

-- CreateIndex
CREATE INDEX "historical_insurer_statement_tenantId_loadId_counterpartySe_idx" ON "reinsurance"."historical_insurer_statement"("tenantId", "loadId", "counterpartySearch", "id");

-- CreateIndex
CREATE INDEX "historical_insurer_statement_tenantId_loadId_currency_id_idx" ON "reinsurance"."historical_insurer_statement"("tenantId", "loadId", "currency", "id");

-- CreateIndex
CREATE INDEX "historical_insurer_statement_tenantId_loadId_offerStatus_pa_idx" ON "reinsurance"."historical_insurer_statement"("tenantId", "loadId", "offerStatus", "paymentStatus", "id");

-- CreateIndex
CREATE INDEX "historical_insurer_statement_tenantId_loadId_closedDate_id_idx" ON "reinsurance"."historical_insurer_statement"("tenantId", "loadId", "closedDate", "id");

-- CreateIndex
CREATE UNIQUE INDEX "historical_insurer_statement_tenantId_loadId_id_key" ON "reinsurance"."historical_insurer_statement"("tenantId", "loadId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "historical_insurer_statement_tenantId_loadId_fileId_sourceR_key" ON "reinsurance"."historical_insurer_statement"("tenantId", "loadId", "fileId", "sourceRow");

-- CreateIndex
CREATE UNIQUE INDEX "historical_insurer_statement_tenantId_loadId_matchId_key" ON "reinsurance"."historical_insurer_statement"("tenantId", "loadId", "matchId");

-- CreateIndex
CREATE INDEX "historical_reinsurer_statement_tenantId_loadId_year_id_idx" ON "reinsurance"."historical_reinsurer_statement"("tenantId", "loadId", "year", "id");

-- CreateIndex
CREATE INDEX "historical_reinsurer_statement_tenantId_loadId_policySearch_idx" ON "reinsurance"."historical_reinsurer_statement"("tenantId", "loadId", "policySearch", "id");

-- CreateIndex
CREATE INDEX "historical_reinsurer_statement_tenantId_loadId_counterparty_idx" ON "reinsurance"."historical_reinsurer_statement"("tenantId", "loadId", "counterpartySearch", "id");

-- CreateIndex
CREATE INDEX "historical_reinsurer_statement_tenantId_loadId_currency_id_idx" ON "reinsurance"."historical_reinsurer_statement"("tenantId", "loadId", "currency", "id");

-- CreateIndex
CREATE INDEX "historical_reinsurer_statement_tenantId_loadId_offerStatus__idx" ON "reinsurance"."historical_reinsurer_statement"("tenantId", "loadId", "offerStatus", "paymentStatus", "id");

-- CreateIndex
CREATE INDEX "historical_reinsurer_statement_tenantId_loadId_closedDate_i_idx" ON "reinsurance"."historical_reinsurer_statement"("tenantId", "loadId", "closedDate", "id");

-- CreateIndex
CREATE UNIQUE INDEX "historical_reinsurer_statement_tenantId_loadId_id_key" ON "reinsurance"."historical_reinsurer_statement"("tenantId", "loadId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "historical_reinsurer_statement_tenantId_loadId_fileId_sourc_key" ON "reinsurance"."historical_reinsurer_statement"("tenantId", "loadId", "fileId", "sourceRow");

-- CreateIndex
CREATE INDEX "historical_statement_link_tenantId_loadId_insurerRowId_id_idx" ON "reinsurance"."historical_statement_link"("tenantId", "loadId", "insurerRowId", "id");

-- CreateIndex
CREATE INDEX "historical_statement_link_tenantId_loadId_matchId_id_idx" ON "reinsurance"."historical_statement_link"("tenantId", "loadId", "matchId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "historical_statement_link_tenantId_loadId_reinsurerRowId_key" ON "reinsurance"."historical_statement_link"("tenantId", "loadId", "reinsurerRowId");

-- AddForeignKey
ALTER TABLE "reinsurance"."historical_statement_file" ADD CONSTRAINT "historical_statement_file_tenantId_loadId_fkey" FOREIGN KEY ("tenantId", "loadId") REFERENCES "reinsurance"."historical_statement_load"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reinsurance"."historical_insurer_statement" ADD CONSTRAINT "historical_insurer_statement_tenantId_loadId_fileId_year_fkey" FOREIGN KEY ("tenantId", "loadId", "fileId", "year") REFERENCES "reinsurance"."historical_statement_file"("tenantId", "loadId", "id", "year") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reinsurance"."historical_reinsurer_statement" ADD CONSTRAINT "historical_reinsurer_statement_tenantId_loadId_fileId_year_fkey" FOREIGN KEY ("tenantId", "loadId", "fileId", "year") REFERENCES "reinsurance"."historical_statement_file"("tenantId", "loadId", "id", "year") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reinsurance"."historical_statement_link" ADD CONSTRAINT "historical_statement_link_tenantId_loadId_insurerRowId_fkey" FOREIGN KEY ("tenantId", "loadId", "insurerRowId") REFERENCES "reinsurance"."historical_insurer_statement"("tenantId", "loadId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reinsurance"."historical_statement_link" ADD CONSTRAINT "historical_statement_link_tenantId_loadId_reinsurerRowId_fkey" FOREIGN KEY ("tenantId", "loadId", "reinsurerRowId") REFERENCES "reinsurance"."historical_reinsurer_statement"("tenantId", "loadId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Archive-only integrity and lifecycle protections. No operational tables are altered.
CREATE UNIQUE INDEX "historical_statement_one_published_version"
ON "reinsurance"."historical_statement_load" ("tenantId", "datasetKey")
WHERE "status" = 'PUBLISHED';

ALTER TABLE "reinsurance"."historical_statement_load"
  ADD CONSTRAINT "historical_load_manifest_hash" CHECK ("contentManifestSha256" ~ '^[0-9a-f]{64}$' AND ("matchManifestSha256" IS NULL OR "matchManifestSha256" ~ '^[0-9a-f]{64}$')),
  ADD CONSTRAINT "historical_load_identity" CHECK (btrim("tenantId") <> '' AND btrim("datasetKey") <> '' AND btrim("datasetVersion") <> '' AND btrim("createdByUserId") <> ''),
  ADD CONSTRAINT "historical_load_json_objects" CHECK (jsonb_typeof("sourceManifest") = 'object' AND "sourceManifest" ? 'files' AND jsonb_typeof("sourceManifest"->'files') = 'array' AND jsonb_typeof("validationSummary") = 'object' AND jsonb_typeof("progress") = 'object' AND jsonb_typeof("lifecycleEvents") = 'array');

-- Numeric lexemes stay strings in rawCells; no JSON floating point conversion.
CREATE FUNCTION "reinsurance"."historical_statement_cells_valid"(cells jsonb, source_row integer)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN jsonb_typeof(cells) <> 'array' THEN false ELSE
    jsonb_array_length(cells) = 29 AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(cells) WITH ORDINALITY AS c(value, position)
      WHERE jsonb_typeof(value) <> 'object'
        OR NOT (value ?& ARRAY['columnIndex','columnLetter','sourceAddress','state','type','xmlValue','resolvedText','styleIndex','formula','formulaAttributes','cachedValue'])
        OR jsonb_typeof(value->'columnIndex') IS DISTINCT FROM 'number'
        OR value->>'columnIndex' IS DISTINCT FROM position::text
        OR value->>'columnLetter' IS DISTINCT FROM CASE WHEN position <= 26 THEN chr(64 + position::integer) ELSE 'A' || chr(38 + position::integer) END
        OR value->>'sourceAddress' IS DISTINCT FROM (CASE WHEN position <= 26 THEN chr(64 + position::integer) ELSE 'A' || chr(38 + position::integer) END || source_row::text)
        OR coalesce(value->>'state','') NOT IN ('VALUE','BLANK','MISSING')
        OR (value->>'state' = 'VALUE' AND coalesce(value->>'type','') NOT IN ('SHARED_STRING','INLINE_STRING','NUMBER','BOOLEAN','ERROR','FORMULA'))
        OR jsonb_typeof(value->'xmlValue') NOT IN ('string','null')
        OR jsonb_typeof(value->'resolvedText') NOT IN ('string','null')
        OR jsonb_typeof(value->'formula') NOT IN ('string','null')
        OR jsonb_typeof(value->'cachedValue') NOT IN ('string','null')
        OR jsonb_typeof(value->'formulaAttributes') NOT IN ('object','null')
        OR (jsonb_typeof(value->'styleIndex') <> 'null' AND (jsonb_typeof(value->'styleIndex') <> 'number' OR NOT (value->>'styleIndex' ~ '^[0-9]+$')))
    ) END;
$$;

ALTER TABLE "reinsurance"."historical_statement_file"
  ADD CONSTRAINT "historical_file_source" CHECK ("year" BETWEEN 2021 AND 2025 AND "sheetName" = 'Brokerage Statement' AND "sourceColumnCount" = 29 AND "byteSize" > 0 AND "businessRowCount" >= 0 AND "physicalRowCount" >= "businessRowCount" + 1 AND btrim("originalFileName") <> '' AND btrim("rawStorageKey") <> '' AND btrim("rawStorageProvider") <> '' AND btrim("createdByUserId") <> ''),
  ADD CONSTRAINT "historical_file_hashes" CHECK ("sha256" ~ '^[0-9a-f]{64}$' AND "headerSha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "historical_file_raw_header" CHECK ("reinsurance"."historical_statement_cells_valid"("headerCells", 1)),
  ADD CONSTRAINT "historical_file_metadata" CHECK (jsonb_typeof("workbookMetadata") = 'object');

ALTER TABLE "reinsurance"."historical_insurer_statement"
  ADD CONSTRAINT "historical_insurer_source" CHECK ("sourceRow" >= 2 AND "year" BETWEEN 2021 AND 2025 AND "rowSha256" ~ '^[0-9a-f]{64}$' AND btrim("createdByUserId") <> ''),
  ADD CONSTRAINT "historical_insurer_raw_cells" CHECK ("reinsurance"."historical_statement_cells_valid"("rawCells", "sourceRow") AND jsonb_typeof("qualityFlags") = 'array'),
  ADD CONSTRAINT "historical_insurer_match_id" CHECK ("matchId" IS NULL OR (length("matchId") BETWEEN 1 AND 128 AND btrim("matchId") <> ''));
ALTER TABLE "reinsurance"."historical_reinsurer_statement"
  ADD CONSTRAINT "historical_reinsurer_source" CHECK ("sourceRow" >= 2 AND "year" BETWEEN 2021 AND 2025 AND "rowSha256" ~ '^[0-9a-f]{64}$' AND btrim("createdByUserId") <> ''),
  ADD CONSTRAINT "historical_reinsurer_raw_cells" CHECK ("reinsurance"."historical_statement_cells_valid"("rawCells", "sourceRow") AND jsonb_typeof("qualityFlags") = 'array');
ALTER TABLE "reinsurance"."historical_statement_link"
  ADD CONSTRAINT "historical_link_approval" CHECK (length("matchId") BETWEEN 1 AND 128 AND btrim("matchId") <> '' AND btrim("approvalRef") <> '' AND btrim("approvedByUserId") <> '' AND btrim("createdByUserId") <> '' AND "evidenceSha256" ~ '^[0-9a-f]{64}$' AND jsonb_typeof("evidence") = 'object' AND "evidence" <> '{}'::jsonb);

-- Serialize all content changes with load state changes. Published rows cannot be
-- edited even through a direct generated Prisma client. State updates acquire
-- the same parent lock; checking status without a lock would be race-prone.
CREATE FUNCTION "reinsurance"."historical_statement_content_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  owner_row "reinsurance"."historical_statement_load"%ROWTYPE;
  record_data jsonb;
  file_row "reinsurance"."historical_statement_file"%ROWTYPE;
  linked_match text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Historical statement source content is immutable' USING ERRCODE = '55000';
  END IF;
  record_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  SELECT * INTO owner_row FROM "reinsurance"."historical_statement_load"
    WHERE "tenantId" = record_data->>'tenantId' AND "id" = record_data->>'loadId' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Archive parent must belong to the same tenant and dataset' USING ERRCODE = '23503';
  END IF;
  IF (TG_OP = 'INSERT' AND owner_row.status <> 'STAGING') OR
     (TG_OP = 'DELETE' AND owner_row.status NOT IN ('STAGING', 'ROLLED_BACK')) THEN
    RAISE EXCEPTION 'Archive content cannot change in state %', owner_row.status USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME IN ('historical_insurer_statement','historical_reinsurer_statement') THEN
    SELECT * INTO file_row FROM "reinsurance"."historical_statement_file"
      WHERE "tenantId" = NEW."tenantId" AND "loadId" = NEW."loadId" AND "id" = NEW."fileId" AND "year" = NEW."year";
    IF NOT FOUND OR (TG_TABLE_NAME = 'historical_insurer_statement' AND file_row.kind <> 'INSURER') OR
       (TG_TABLE_NAME = 'historical_reinsurer_statement' AND file_row.kind <> 'REINSURER') THEN
      RAISE EXCEPTION 'Archive file kind or tenant/dataset/year does not match source row' USING ERRCODE = '23503';
    END IF;
    IF NEW."sourceRow" > file_row."physicalRowCount" THEN
      RAISE EXCEPTION 'Source row lies outside the physical workbook' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'historical_statement_link' THEN
    SELECT "matchId" INTO linked_match FROM "reinsurance"."historical_insurer_statement"
      WHERE "tenantId" = NEW."tenantId" AND "loadId" = NEW."loadId" AND "id" = NEW."insurerRowId";
    IF NOT FOUND OR linked_match IS DISTINCT FROM NEW."matchId" THEN
      RAISE EXCEPTION 'Match ID must equal the approved insurer group in this tenant/dataset' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "historical_file_content_guard" BEFORE INSERT OR UPDATE OR DELETE ON "reinsurance"."historical_statement_file" FOR EACH ROW EXECUTE FUNCTION "reinsurance"."historical_statement_content_guard"();
CREATE TRIGGER "historical_insurer_content_guard" BEFORE INSERT OR UPDATE OR DELETE ON "reinsurance"."historical_insurer_statement" FOR EACH ROW EXECUTE FUNCTION "reinsurance"."historical_statement_content_guard"();
CREATE TRIGGER "historical_reinsurer_content_guard" BEFORE INSERT OR UPDATE OR DELETE ON "reinsurance"."historical_reinsurer_statement" FOR EACH ROW EXECUTE FUNCTION "reinsurance"."historical_statement_content_guard"();
CREATE TRIGGER "historical_link_content_guard" BEFORE INSERT OR UPDATE OR DELETE ON "reinsurance"."historical_statement_link" FOR EACH ROW EXECUTE FUNCTION "reinsurance"."historical_statement_content_guard"();

CREATE FUNCTION "reinsurance"."historical_statement_assert_complete"(owner_tenant text, owner_id text, manifest jsonb, summary jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  actual_files bigint;
  actual_insurers bigint;
  actual_reinsurers bigint;
  actual_links bigint;
BEGIN
  SELECT count(*) INTO actual_files FROM "reinsurance"."historical_statement_file" WHERE "tenantId" = owner_tenant AND "loadId" = owner_id;
  SELECT count(*) INTO actual_insurers FROM "reinsurance"."historical_insurer_statement" WHERE "tenantId" = owner_tenant AND "loadId" = owner_id;
  SELECT count(*) INTO actual_reinsurers FROM "reinsurance"."historical_reinsurer_statement" WHERE "tenantId" = owner_tenant AND "loadId" = owner_id;
  SELECT count(*) INTO actual_links FROM "reinsurance"."historical_statement_link" WHERE "tenantId" = owner_tenant AND "loadId" = owner_id;
  IF summary->'validated' IS DISTINCT FROM 'true'::jsonb OR actual_files = 0 OR
     summary->'fileCount' IS DISTINCT FROM to_jsonb(actual_files) OR
     summary->'insurerRowCount' IS DISTINCT FROM to_jsonb(actual_insurers) OR
     summary->'reinsurerRowCount' IS DISTINCT FROM to_jsonb(actual_reinsurers) OR
     summary->'linkCount' IS DISTINCT FROM to_jsonb(actual_links) OR
     jsonb_array_length(manifest->'files') <> actual_files THEN
    RAISE EXCEPTION 'Archive validation counts do not match actual staged content' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "reinsurance"."historical_statement_file" f
    WHERE f."tenantId" = owner_tenant AND f."loadId" = owner_id AND (
      NOT EXISTS (SELECT 1 FROM jsonb_array_elements(manifest->'files') m
        WHERE m->>'sha256' = f.sha256 AND m->>'kind' = f.kind::text AND
          m->>'year' = f.year::text AND m->>'sheetName' = f."sheetName" AND m->>'headerSha256' = f."headerSha256") OR
      f."businessRowCount" <> CASE WHEN f.kind = 'INSURER' THEN
        (SELECT count(*) FROM "reinsurance"."historical_insurer_statement" r WHERE r."tenantId"=owner_tenant AND r."loadId"=owner_id AND r."fileId"=f.id)
        ELSE (SELECT count(*) FROM "reinsurance"."historical_reinsurer_statement" r WHERE r."tenantId"=owner_tenant AND r."loadId"=owner_id AND r."fileId"=f.id) END
    )
  ) THEN
    RAISE EXCEPTION 'Archive source manifest or physical row counts are incomplete' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION "reinsurance"."historical_statement_load_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_events integer;
  new_events integer;
  event jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Archive load provenance must be retained' USING ERRCODE = '55000';
  END IF;
  IF jsonb_typeof(NEW."lifecycleEvents") IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Archive lifecycle events must be an array' USING ERRCODE = '23514';
  END IF;
  new_events := jsonb_array_length(NEW."lifecycleEvents");
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'STAGING' OR new_events <> 1 OR NEW."readyAt" IS NOT NULL OR NEW."publishedAt" IS NOT NULL OR
       NEW."rolledBackAt" IS NOT NULL OR NEW."supersededAt" IS NOT NULL OR NEW."failedAt" IS NOT NULL OR
       NEW."publishedByUserId" IS NOT NULL OR NEW."rolledBackByUserId" IS NOT NULL OR
       NEW."publicationApprovalRef" IS NOT NULL OR NEW."rollbackReason" IS NOT NULL OR NEW."supersededByLoadId" IS NOT NULL THEN
      RAISE EXCEPTION 'A new archive load must start in STAGING with initial provenance' USING ERRCODE = '23514';
    END IF;
  ELSE
    -- Serialize competing versions of a dataset as well as changes to its content.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW."tenantId" || ':' || NEW."datasetKey", 0));
    IF ROW(NEW.id,NEW."tenantId",NEW."datasetKey",NEW."datasetVersion",NEW."contentManifestSha256",NEW."matchManifestSha256",NEW."sourceManifest",NEW."contractVersion",NEW."parserVersion",NEW."loaderVersion",NEW."createdByUserId",NEW."createdAt",NEW."startedAt")
       IS DISTINCT FROM ROW(OLD.id,OLD."tenantId",OLD."datasetKey",OLD."datasetVersion",OLD."contentManifestSha256",OLD."matchManifestSha256",OLD."sourceManifest",OLD."contractVersion",OLD."parserVersion",OLD."loaderVersion",OLD."createdByUserId",OLD."createdAt",OLD."startedAt") THEN
      RAISE EXCEPTION 'Archive dataset/version/source identity is immutable' USING ERRCODE = '55000';
    END IF;
    old_events := jsonb_array_length(OLD."lifecycleEvents");
    IF new_events < old_events OR EXISTS (SELECT 1 FROM generate_series(0, old_events - 1) i WHERE NEW."lifecycleEvents"->i IS DISTINCT FROM OLD."lifecycleEvents"->i) THEN
      RAISE EXCEPTION 'Archive lifecycle provenance is append-only' USING ERRCODE = '55000';
    END IF;
    IF OLD.status = 'ROLLED_BACK' THEN
      RAISE EXCEPTION 'Rolled back archive loads are terminal' USING ERRCODE = '55000';
    END IF;
    IF OLD.status IN ('READY','PUBLISHED','SUPERSEDED') AND ROW(NEW."validationSummary",NEW.progress) IS DISTINCT FROM ROW(OLD."validationSummary",OLD.progress) THEN
      RAISE EXCEPTION 'Validated archive content summary is immutable' USING ERRCODE = '55000';
    END IF;
    IF (NEW."readyAt" IS DISTINCT FROM OLD."readyAt" AND NEW.status <> 'READY') OR
       (ROW(NEW."publishedAt",NEW."publishedByUserId",NEW."publicationApprovalRef") IS DISTINCT FROM ROW(OLD."publishedAt",OLD."publishedByUserId",OLD."publicationApprovalRef") AND NEW.status <> 'PUBLISHED') OR
       (ROW(NEW."supersededAt",NEW."supersededByLoadId") IS DISTINCT FROM ROW(OLD."supersededAt",OLD."supersededByLoadId") AND NEW.status <> 'SUPERSEDED') OR
       (NEW."failedAt" IS DISTINCT FROM OLD."failedAt" AND NEW.status <> 'FAILED') OR
       (ROW(NEW."rolledBackAt",NEW."rolledBackByUserId",NEW."rollbackReason") IS DISTINCT FROM ROW(OLD."rolledBackAt",OLD."rolledBackByUserId",OLD."rollbackReason") AND NEW.status <> 'ROLLED_BACK') THEN
      RAISE EXCEPTION 'Archive timestamps/actors can change only for their transition' USING ERRCODE = '55000';
    END IF;
    IF NEW.status = OLD.status THEN
      IF new_events <> old_events OR (OLD.status NOT IN ('STAGING','FAILED') AND NEW."errorSummary" IS DISTINCT FROM OLD."errorSummary") THEN
        RAISE EXCEPTION 'Lifecycle changes require an explicit state transition' USING ERRCODE = '55000';
      END IF;
      IF ROW(NEW."readyAt",NEW."publishedAt",NEW."failedAt",NEW."rolledBackAt",NEW."supersededAt",NEW."publishedByUserId",NEW."rolledBackByUserId",NEW."publicationApprovalRef",NEW."rollbackReason",NEW."supersededByLoadId")
         IS DISTINCT FROM ROW(OLD."readyAt",OLD."publishedAt",OLD."failedAt",OLD."rolledBackAt",OLD."supersededAt",OLD."publishedByUserId",OLD."rolledBackByUserId",OLD."publicationApprovalRef",OLD."rollbackReason",OLD."supersededByLoadId") THEN
        RAISE EXCEPTION 'Lifecycle metadata changes require a state transition' USING ERRCODE = '55000';
      END IF;
      RETURN NEW;
    END IF;
    IF NOT ((OLD.status='STAGING' AND NEW.status IN ('READY','FAILED','ROLLED_BACK')) OR
      (OLD.status='READY' AND NEW.status IN ('PUBLISHED','FAILED','ROLLED_BACK')) OR
      (OLD.status='FAILED' AND NEW.status IN ('STAGING','ROLLED_BACK')) OR
      (OLD.status='PUBLISHED' AND NEW.status IN ('SUPERSEDED','ROLLED_BACK')) OR
      (OLD.status='SUPERSEDED' AND NEW.status IN ('PUBLISHED','ROLLED_BACK'))) OR new_events <> old_events + 1 THEN
      RAISE EXCEPTION 'Invalid archive state transition: % -> %', OLD.status, NEW.status USING ERRCODE = '23514';
    END IF;
  END IF;
  event := NEW."lifecycleEvents"->(new_events - 1);
  IF event->>'status' IS DISTINCT FROM NEW.status::text OR coalesce(btrim(event->>'actorUserId'),'') = '' OR coalesce(event->>'at','') = '' THEN
    RAISE EXCEPTION 'Archive state transition requires actor/time/status provenance' USING ERRCODE = '23514';
  END IF;
  PERFORM (event->>'at')::timestamptz;
  IF TG_OP='INSERT' AND event->>'actorUserId' IS DISTINCT FROM NEW."createdByUserId" THEN
    RAISE EXCEPTION 'Initial archive actor must match its creator' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IN ('READY','PUBLISHED') THEN
    PERFORM "reinsurance"."historical_statement_assert_complete"(NEW."tenantId",NEW.id,NEW."sourceManifest",NEW."validationSummary");
  END IF;
  IF NEW.status='READY' AND NEW."readyAt" IS NULL THEN
    RAISE EXCEPTION 'READY requires readyAt' USING ERRCODE = '23514';
  ELSIF NEW.status='PUBLISHED' AND (NEW."publishedAt" IS NULL OR coalesce(btrim(NEW."publicationApprovalRef"),'')='' OR NEW."publishedByUserId" IS DISTINCT FROM event->>'actorUserId') THEN
    RAISE EXCEPTION 'Publication requires approval, actor and time' USING ERRCODE = '23514';
  ELSIF NEW.status='SUPERSEDED' AND (NEW."supersededAt" IS NULL OR NOT EXISTS (SELECT 1 FROM "reinsurance"."historical_statement_load" l WHERE l.id=NEW."supersededByLoadId" AND l."tenantId"=NEW."tenantId" AND l."datasetKey"=NEW."datasetKey" AND l.id<>NEW.id AND l.status IN ('READY','PUBLISHED'))) THEN
    RAISE EXCEPTION 'Supersession requires a same-tenant/dataset replacement and time' USING ERRCODE = '23514';
  ELSIF NEW.status='FAILED' AND (NEW."failedAt" IS NULL OR NEW."errorSummary" IS NULL) THEN
    RAISE EXCEPTION 'Failure requires time and reason' USING ERRCODE = '23514';
  ELSIF NEW.status='ROLLED_BACK' AND (NEW."rolledBackAt" IS NULL OR coalesce(btrim(NEW."rollbackReason"),'')='' OR NEW."rolledBackByUserId" IS DISTINCT FROM event->>'actorUserId') THEN
    RAISE EXCEPTION 'Rollback requires reason, actor and time' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "historical_load_guard" BEFORE INSERT OR UPDATE OR DELETE ON "reinsurance"."historical_statement_load" FOR EACH ROW EXECUTE FUNCTION "reinsurance"."historical_statement_load_guard"();

-- Rollback must remove ALL content in the same transaction, not merely hide a
-- partly deleted published dataset. The Load row/audit manifest is retained.
CREATE FUNCTION "reinsurance"."historical_statement_rollback_empty"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='ROLLED_BACK' AND EXISTS (SELECT 1 FROM "reinsurance"."historical_statement_file" WHERE "tenantId"=NEW."tenantId" AND "loadId"=NEW.id) THEN
    RAISE EXCEPTION 'Archive rollback must delete all owned content atomically' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "historical_rollback_empty" AFTER UPDATE ON "reinsurance"."historical_statement_load" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "reinsurance"."historical_statement_rollback_empty"();

-- TRUNCATE bypasses row triggers: explicitly disallow it on all archive tables.
CREATE FUNCTION "reinsurance"."historical_statement_no_truncate"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Archive provenance/content cannot be truncated' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER "historical_load_no_truncate" BEFORE TRUNCATE ON "reinsurance"."historical_statement_load" FOR EACH STATEMENT EXECUTE FUNCTION "reinsurance"."historical_statement_no_truncate"();
CREATE TRIGGER "historical_file_no_truncate" BEFORE TRUNCATE ON "reinsurance"."historical_statement_file" FOR EACH STATEMENT EXECUTE FUNCTION "reinsurance"."historical_statement_no_truncate"();
CREATE TRIGGER "historical_insurer_no_truncate" BEFORE TRUNCATE ON "reinsurance"."historical_insurer_statement" FOR EACH STATEMENT EXECUTE FUNCTION "reinsurance"."historical_statement_no_truncate"();
CREATE TRIGGER "historical_reinsurer_no_truncate" BEFORE TRUNCATE ON "reinsurance"."historical_reinsurer_statement" FOR EACH STATEMENT EXECUTE FUNCTION "reinsurance"."historical_statement_no_truncate"();
CREATE TRIGGER "historical_link_no_truncate" BEFORE TRUNCATE ON "reinsurance"."historical_statement_link" FOR EACH STATEMENT EXECUTE FUNCTION "reinsurance"."historical_statement_no_truncate"();
