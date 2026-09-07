CREATE TYPE "hr"."CompanyAgreementState" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "hr"."CompanyAgreementSignatureStatus" AS ENUM ('SIGNED', 'DECLINED', 'REVOKED');

CREATE TYPE "hr"."CompanyAgreementSignatureType" AS ENUM ('ACKNOWLEDGEMENT', 'TYPED');

ALTER TABLE "hr"."CompanyAgreement"
ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "documentUrl" TEXT,
ADD COLUMN "state" "hr"."CompanyAgreementState" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "activeVersionId" TEXT;

CREATE TABLE "hr"."CompanyAgreementVersion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "documentUrl" TEXT,
  "agreementHash" TEXT NOT NULL,
  "publishedBy" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyAgreementVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hr"."CompanyAgreementSignature" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "userId" TEXT,
  "status" "hr"."CompanyAgreementSignatureStatus" NOT NULL,
  "signatureType" "hr"."CompanyAgreementSignatureType" NOT NULL,
  "typedName" TEXT,
  "consentText" TEXT NOT NULL,
  "agreementHash" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "signedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "declineReason" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyAgreementSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyAgreementVersion_tenantId_agreementId_version_key"
ON "hr"."CompanyAgreementVersion"("tenantId", "agreementId", "version");

CREATE UNIQUE INDEX "CompanyAgreementVersion_tenantId_agreementHash_key"
ON "hr"."CompanyAgreementVersion"("tenantId", "agreementHash");

CREATE INDEX "CompanyAgreementVersion_tenantId_agreementId_idx"
ON "hr"."CompanyAgreementVersion"("tenantId", "agreementId");

CREATE UNIQUE INDEX "CompanyAgreementSignature_tenantId_versionId_employeeId_key"
ON "hr"."CompanyAgreementSignature"("tenantId", "versionId", "employeeId");

CREATE INDEX "CompanyAgreementSignature_tenantId_employeeId_status_idx"
ON "hr"."CompanyAgreementSignature"("tenantId", "employeeId", "status");

CREATE INDEX "CompanyAgreementSignature_tenantId_agreementId_status_idx"
ON "hr"."CompanyAgreementSignature"("tenantId", "agreementId", "status");

CREATE INDEX "CompanyAgreementSignature_tenantId_versionId_status_idx"
ON "hr"."CompanyAgreementSignature"("tenantId", "versionId", "status");

CREATE INDEX "CompanyAgreement_tenantId_state_idx"
ON "hr"."CompanyAgreement"("tenantId", "state");

CREATE INDEX "CompanyAgreement_tenantId_activeVersionId_idx"
ON "hr"."CompanyAgreement"("tenantId", "activeVersionId");

ALTER TABLE "hr"."CompanyAgreementVersion"
ADD CONSTRAINT "CompanyAgreementVersion_agreementId_fkey"
FOREIGN KEY ("agreementId") REFERENCES "hr"."CompanyAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr"."CompanyAgreementSignature"
ADD CONSTRAINT "CompanyAgreementSignature_agreementId_fkey"
FOREIGN KEY ("agreementId") REFERENCES "hr"."CompanyAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr"."CompanyAgreementSignature"
ADD CONSTRAINT "CompanyAgreementSignature_versionId_fkey"
FOREIGN KEY ("versionId") REFERENCES "hr"."CompanyAgreementVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr"."CompanyAgreementSignature"
ADD CONSTRAINT "CompanyAgreementSignature_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "hr"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH created_versions AS (
  INSERT INTO "hr"."CompanyAgreementVersion" (
    "id",
    "tenantId",
    "agreementId",
    "version",
    "title",
    "details",
    "documentUrl",
    "agreementHash",
    "publishedBy",
    "publishedAt",
    "createdAt"
  )
  SELECT
    md5(concat_ws('|', 'company-agreement-version', ca."tenantId", ca."id", '1'))::TEXT,
    ca."tenantId",
    ca."id",
    1,
    ca."title",
    ca."details",
    ca."documentUrl",
    md5(concat_ws('|', ca."tenantId", ca."id", ca."title", ca."details", COALESCE(ca."documentUrl", ''), 'a')) ||
      md5(concat_ws('|', ca."tenantId", ca."id", ca."title", ca."details", COALESCE(ca."documentUrl", ''), 'b')),
    ca."createdBy",
    ca."createdAt",
    ca."createdAt"
  FROM "hr"."CompanyAgreement" ca
  WHERE NOT EXISTS (
    SELECT 1
    FROM "hr"."CompanyAgreementVersion" cav
    WHERE cav."tenantId" = ca."tenantId"
      AND cav."agreementId" = ca."id"
      AND cav."version" = 1
  )
  RETURNING "id", "agreementId"
)
UPDATE "hr"."CompanyAgreement" ca
SET
  "state" = 'PUBLISHED',
  "activeVersionId" = cv."id"
FROM created_versions cv
WHERE ca."id" = cv."agreementId";
