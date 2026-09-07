ALTER TABLE reinsurance."PlacementPayment"
  ADD COLUMN "endorsementClosingId" TEXT;

ALTER TABLE reinsurance."PlacementPayment"
  ADD CONSTRAINT "PlacementPayment_one_closing_source_check"
  CHECK (
    NOT ("closingId" IS NOT NULL AND "endorsementClosingId" IS NOT NULL)
  );

CREATE INDEX "PlacementPayment_tenantId_endorsementClosingId_createdAt_idx"
  ON reinsurance."PlacementPayment"("tenantId", "endorsementClosingId", "createdAt");

ALTER TABLE reinsurance."PlacementPayment"
  ADD CONSTRAINT "PlacementPayment_endorsementClosingId_tenantId_fkey"
  FOREIGN KEY ("endorsementClosingId", "tenantId")
  REFERENCES reinsurance."PlacementEndorsementClosing"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
