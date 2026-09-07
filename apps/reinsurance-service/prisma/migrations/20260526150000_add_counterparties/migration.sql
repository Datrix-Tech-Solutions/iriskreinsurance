-- CreateEnum
CREATE TYPE "reinsurance"."CounterpartyType" AS ENUM ('CEDANT', 'REINSURER', 'BROKER');

-- CreateTable
CREATE TABLE "reinsurance"."Counterparty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "reinsurance"."CounterpartyType" NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "archivedByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counterparty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."CounterpartyContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CounterpartyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."CounterpartyAddress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CounterpartyAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Counterparty_id_tenantId_key" ON "reinsurance"."Counterparty"("id", "tenantId");
CREATE INDEX "Counterparty_tenantId_type_archivedAt_name_idx" ON "reinsurance"."Counterparty"("tenantId", "type", "archivedAt", "name");
CREATE INDEX "Counterparty_tenantId_archivedAt_createdAt_idx" ON "reinsurance"."Counterparty"("tenantId", "archivedAt", "createdAt");
-- Allow a name to be reused only after its previous counterparty is archived.
CREATE UNIQUE INDEX "Counterparty_active_name_type_key" ON "reinsurance"."Counterparty"("tenantId", "type", "normalizedName") WHERE "archivedAt" IS NULL;
CREATE INDEX "CounterpartyContact_tenantId_counterpartyId_idx" ON "reinsurance"."CounterpartyContact"("tenantId", "counterpartyId");
CREATE INDEX "CounterpartyAddress_tenantId_counterpartyId_idx" ON "reinsurance"."CounterpartyAddress"("tenantId", "counterpartyId");

-- AddForeignKey
ALTER TABLE "reinsurance"."CounterpartyContact" ADD CONSTRAINT "CounterpartyContact_counterpartyId_tenantId_fkey" FOREIGN KEY ("counterpartyId", "tenantId") REFERENCES "reinsurance"."Counterparty"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reinsurance"."CounterpartyAddress" ADD CONSTRAINT "CounterpartyAddress_counterpartyId_tenantId_fkey" FOREIGN KEY ("counterpartyId", "tenantId") REFERENCES "reinsurance"."Counterparty"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
