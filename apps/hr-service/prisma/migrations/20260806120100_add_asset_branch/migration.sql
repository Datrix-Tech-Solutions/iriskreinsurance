-- The Add/Edit Asset forms have always collected a Branch, but Asset had no
-- column to store it, so the selection was silently dropped on save.

ALTER TABLE "hr"."Asset" ADD COLUMN "branchId" TEXT;

CREATE INDEX "Asset_tenantId_branchId_idx" ON "hr"."Asset"("tenantId", "branchId");

ALTER TABLE "hr"."Asset" ADD CONSTRAINT "Asset_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "hr"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
