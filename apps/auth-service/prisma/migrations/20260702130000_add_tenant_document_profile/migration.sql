CREATE TABLE "w_auth"."TenantDocumentProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "registrationNumber" TEXT,
  "taxNumber" TEXT,
  "physicalAddress" TEXT,
  "postalAddress" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "footerText" TEXT,
  "defaultCurrency" TEXT NOT NULL,
  "logoObjectKey" TEXT,
  "logoMimeType" TEXT,
  "logoFileName" TEXT,
  "logoSizeBytes" INTEGER,
  "signatureObjectKey" TEXT,
  "signatureMimeType" TEXT,
  "signatureFileName" TEXT,
  "signatureSizeBytes" INTEGER,
  "authorizedSignatoryName" TEXT,
  "authorizedSignatoryTitle" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantDocumentProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "w_auth"."TenantBankAccount" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "branchName" TEXT,
  "accountName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "swiftCode" TEXT,
  "sortCode" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantDocumentProfile_tenantId_key"
  ON "w_auth"."TenantDocumentProfile"("tenantId");
CREATE INDEX "TenantDocumentProfile_tenantId_isActive_idx"
  ON "w_auth"."TenantDocumentProfile"("tenantId", "isActive");
CREATE INDEX "TenantDocumentProfile_createdByUserId_idx"
  ON "w_auth"."TenantDocumentProfile"("createdByUserId");
CREATE INDEX "TenantDocumentProfile_updatedByUserId_idx"
  ON "w_auth"."TenantDocumentProfile"("updatedByUserId");

CREATE UNIQUE INDEX "TenantBankAccount_id_tenantId_key"
  ON "w_auth"."TenantBankAccount"("id", "tenantId");
CREATE INDEX "TenantBankAccount_tenantId_currency_isActive_idx"
  ON "w_auth"."TenantBankAccount"("tenantId", "currency", "isActive");
CREATE INDEX "TenantBankAccount_createdByUserId_idx"
  ON "w_auth"."TenantBankAccount"("createdByUserId");
CREATE INDEX "TenantBankAccount_updatedByUserId_idx"
  ON "w_auth"."TenantBankAccount"("updatedByUserId");
CREATE UNIQUE INDEX "TenantBankAccount_one_default_active_per_currency"
  ON "w_auth"."TenantBankAccount"("tenantId", "currency")
  WHERE "isDefault" = true AND "isActive" = true;

ALTER TABLE "w_auth"."TenantDocumentProfile"
  ADD CONSTRAINT "TenantDocumentProfile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "w_auth"."Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "w_auth"."TenantDocumentProfile"
  ADD CONSTRAINT "TenantDocumentProfile_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "w_auth"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "w_auth"."TenantDocumentProfile"
  ADD CONSTRAINT "TenantDocumentProfile_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "w_auth"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "w_auth"."TenantBankAccount"
  ADD CONSTRAINT "TenantBankAccount_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "w_auth"."Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "w_auth"."TenantBankAccount"
  ADD CONSTRAINT "TenantBankAccount_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "w_auth"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "w_auth"."TenantBankAccount"
  ADD CONSTRAINT "TenantBankAccount_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "w_auth"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
