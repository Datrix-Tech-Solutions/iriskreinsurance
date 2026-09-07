CREATE TABLE "accounting"."AccountClassification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "accounting"."GLAccountCategory" NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountClassification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting"."AccountGroup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "classificationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting"."AccountingAuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "changedFields" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountingAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "accounting"."GLAccount"
  ADD COLUMN "accountGroupId" TEXT;

CREATE UNIQUE INDEX "AccountClassification_id_tenantId_key"
  ON "accounting"."AccountClassification"("id", "tenantId");
CREATE UNIQUE INDEX "AccountClassification_tenantId_code_key"
  ON "accounting"."AccountClassification"("tenantId", "code");
CREATE INDEX "AccountClassification_tenantId_category_isActive_displayOrder_idx"
  ON "accounting"."AccountClassification"("tenantId", "category", "isActive", "displayOrder");

CREATE UNIQUE INDEX "AccountGroup_id_tenantId_key"
  ON "accounting"."AccountGroup"("id", "tenantId");
CREATE UNIQUE INDEX "AccountGroup_tenantId_code_key"
  ON "accounting"."AccountGroup"("tenantId", "code");
CREATE INDEX "AccountGroup_tenantId_classificationId_isActive_displayOrder_idx"
  ON "accounting"."AccountGroup"("tenantId", "classificationId", "isActive", "displayOrder");

CREATE INDEX "AccountingAuditLog_tenantId_entityType_entityId_createdAt_idx"
  ON "accounting"."AccountingAuditLog"("tenantId", "entityType", "entityId", "createdAt");
CREATE INDEX "AccountingAuditLog_tenantId_actorUserId_createdAt_idx"
  ON "accounting"."AccountingAuditLog"("tenantId", "actorUserId", "createdAt");

CREATE INDEX "GLAccount_tenantId_accountGroupId_idx"
  ON "accounting"."GLAccount"("tenantId", "accountGroupId");

ALTER TABLE "accounting"."AccountGroup"
  ADD CONSTRAINT "AccountGroup_classificationId_tenantId_fkey"
  FOREIGN KEY ("classificationId", "tenantId")
  REFERENCES "accounting"."AccountClassification"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."GLAccount"
  ADD CONSTRAINT "GLAccount_accountGroupId_tenantId_fkey"
  FOREIGN KEY ("accountGroupId", "tenantId")
  REFERENCES "accounting"."AccountGroup"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
