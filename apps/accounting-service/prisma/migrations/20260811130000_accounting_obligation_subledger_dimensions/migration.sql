-- Allow the same legal counterparty subledger identity to hold separate
-- obligations under different Accounting-owned control accounts.
DROP INDEX IF EXISTS "accounting"."SubledgerAccount_tenantId_type_externalRef_key";

CREATE UNIQUE INDEX "SubledgerAccount_tenantId_type_externalRef_controlAccountId_key"
  ON "accounting"."SubledgerAccount"("tenantId", "type", "externalRef", "controlAccountId");

CREATE INDEX "SubledgerAccount_tenantId_type_externalRef_idx"
  ON "accounting"."SubledgerAccount"("tenantId", "type", "externalRef");
