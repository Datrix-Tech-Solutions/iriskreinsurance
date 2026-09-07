-- Extend tenant accounting configuration with default AR/AP control accounts.
ALTER TABLE "accounting"."AccountingTenantConfig"
  ADD COLUMN "accountsReceivableControlAccountId" TEXT,
  ADD COLUMN "accountsPayableControlAccountId" TEXT;

CREATE TABLE "accounting"."AccountingCustomer" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradingName" TEXT,
  "primaryContactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "billingAddress" TEXT,
  "countryCode" TEXT,
  "currency" TEXT NOT NULL,
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
  "creditLimit" DECIMAL(20,4),
  "taxNumber" TEXT,
  "externalRef" TEXT,
  "sourceModule" TEXT,
  "subledgerAccountId" TEXT NOT NULL,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountingCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting"."AccountingVendor" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradingName" TEXT,
  "primaryContactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "billingAddress" TEXT,
  "countryCode" TEXT,
  "currency" TEXT NOT NULL,
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
  "taxNumber" TEXT,
  "externalRef" TEXT,
  "sourceModule" TEXT,
  "subledgerAccountId" TEXT NOT NULL,
  "defaultExpenseAccountId" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountingVendor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingCustomer_id_tenantId_key"
  ON "accounting"."AccountingCustomer"("id", "tenantId");
CREATE UNIQUE INDEX "AccountingCustomer_tenantId_code_key"
  ON "accounting"."AccountingCustomer"("tenantId", "code");
CREATE UNIQUE INDEX "AccountingCustomer_tenantId_sourceModule_externalRef_key"
  ON "accounting"."AccountingCustomer"("tenantId", "sourceModule", "externalRef");
CREATE UNIQUE INDEX "AccountingCustomer_subledgerAccountId_tenantId_key"
  ON "accounting"."AccountingCustomer"("subledgerAccountId", "tenantId");
CREATE INDEX "AccountingCustomer_tenantId_isActive_legalName_idx"
  ON "accounting"."AccountingCustomer"("tenantId", "isActive", "legalName");
CREATE INDEX "AccountingCustomer_tenantId_currency_idx"
  ON "accounting"."AccountingCustomer"("tenantId", "currency");
CREATE INDEX "AccountingCustomer_tenantId_sourceModule_externalRef_idx"
  ON "accounting"."AccountingCustomer"("tenantId", "sourceModule", "externalRef");

CREATE UNIQUE INDEX "AccountingVendor_id_tenantId_key"
  ON "accounting"."AccountingVendor"("id", "tenantId");
CREATE UNIQUE INDEX "AccountingVendor_tenantId_code_key"
  ON "accounting"."AccountingVendor"("tenantId", "code");
CREATE UNIQUE INDEX "AccountingVendor_tenantId_sourceModule_externalRef_key"
  ON "accounting"."AccountingVendor"("tenantId", "sourceModule", "externalRef");
CREATE UNIQUE INDEX "AccountingVendor_subledgerAccountId_tenantId_key"
  ON "accounting"."AccountingVendor"("subledgerAccountId", "tenantId");
CREATE INDEX "AccountingVendor_tenantId_isActive_legalName_idx"
  ON "accounting"."AccountingVendor"("tenantId", "isActive", "legalName");
CREATE INDEX "AccountingVendor_tenantId_currency_idx"
  ON "accounting"."AccountingVendor"("tenantId", "currency");
CREATE INDEX "AccountingVendor_tenantId_sourceModule_externalRef_idx"
  ON "accounting"."AccountingVendor"("tenantId", "sourceModule", "externalRef");
CREATE INDEX "AccountingVendor_tenantId_defaultExpenseAccountId_idx"
  ON "accounting"."AccountingVendor"("tenantId", "defaultExpenseAccountId");

ALTER TABLE "accounting"."AccountingTenantConfig"
  ADD CONSTRAINT "AccountingTenantConfig_accountsReceivableControlAccountId_tenantId_fkey"
  FOREIGN KEY ("accountsReceivableControlAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingTenantConfig"
  ADD CONSTRAINT "AccountingTenantConfig_accountsPayableControlAccountId_tenantId_fkey"
  FOREIGN KEY ("accountsPayableControlAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingCustomer"
  ADD CONSTRAINT "AccountingCustomer_subledgerAccountId_tenantId_fkey"
  FOREIGN KEY ("subledgerAccountId", "tenantId")
  REFERENCES "accounting"."SubledgerAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingVendor"
  ADD CONSTRAINT "AccountingVendor_subledgerAccountId_tenantId_fkey"
  FOREIGN KEY ("subledgerAccountId", "tenantId")
  REFERENCES "accounting"."SubledgerAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingVendor"
  ADD CONSTRAINT "AccountingVendor_defaultExpenseAccountId_tenantId_fkey"
  FOREIGN KEY ("defaultExpenseAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
