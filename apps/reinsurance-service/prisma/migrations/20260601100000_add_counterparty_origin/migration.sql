-- Migration: add CounterpartyOrigin enum + origin/country/taxId/licenseNumber to Counterparty

CREATE TYPE reinsurance."CounterpartyOrigin" AS ENUM ('LOCAL', 'FOREIGN');

ALTER TABLE reinsurance."Counterparty"
    ADD COLUMN "origin"        reinsurance."CounterpartyOrigin" NOT NULL DEFAULT 'LOCAL',
    ADD COLUMN "country"       TEXT,
    ADD COLUMN "taxId"         VARCHAR(100),
    ADD COLUMN "licenseNumber" VARCHAR(100);

-- Index: country is a common filter dimension for foreign counterparties
CREATE INDEX "Counterparty_tenantId_origin_archivedAt_idx"
    ON reinsurance."Counterparty"("tenantId", "origin", "archivedAt");
