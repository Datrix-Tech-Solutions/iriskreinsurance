CREATE TYPE reinsurance."PlacementDocumentType" AS ENUM (
  'OFFER_SLIP',
  'CLOSING_SLIP',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
  'ENDORSEMENT_SLIP',
  'ENDORSEMENT_DEBIT_NOTE',
  'ENDORSEMENT_CREDIT_NOTE',
  'CLAIM_CASH_CALL',
  'CLAIM_NOTICE'
);

CREATE TYPE reinsurance."PlacementDocumentStatus" AS ENUM (
  'DRAFT',
  'GENERATED',
  'FAILED',
  'VOID'
);

CREATE TABLE reinsurance."PlacementDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "participantId" TEXT,
  "closingId" TEXT,
  "noteId" TEXT,
  "endorsementId" TEXT,
  "endorsementClosingId" TEXT,
  "claimId" TEXT,
  "claimCashCallId" TEXT,
  "type" reinsurance."PlacementDocumentType" NOT NULL,
  "status" reinsurance."PlacementDocumentStatus" NOT NULL DEFAULT 'GENERATED',
  "documentNumber" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "currency" TEXT,
  "sourceSnapshot" JSONB NOT NULL,
  "renderPayload" JSONB NOT NULL,
  "storageProvider" TEXT,
  "objectKey" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "checksum" TEXT,
  "generatedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "failureReason" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlacementDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementDocument_id_tenantId_key"
  ON reinsurance."PlacementDocument"("id", "tenantId");

CREATE UNIQUE INDEX "PlacementDocument_tenantId_placementId_documentNumber_key"
  ON reinsurance."PlacementDocument"("tenantId", "placementId", "documentNumber");

CREATE INDEX "PlacementDocument_tenantId_placementId_type_status_createdAt_idx"
  ON reinsurance."PlacementDocument"("tenantId", "placementId", "type", "status", "createdAt");

CREATE INDEX "PlacementDocument_tenantId_placementId_status_createdAt_idx"
  ON reinsurance."PlacementDocument"("tenantId", "placementId", "status", "createdAt");

CREATE INDEX "PlacementDocument_tenantId_participantId_createdAt_idx"
  ON reinsurance."PlacementDocument"("tenantId", "participantId", "createdAt");

CREATE INDEX "PlacementDocument_tenantId_closingId_createdAt_idx"
  ON reinsurance."PlacementDocument"("tenantId", "closingId", "createdAt");

CREATE INDEX "PlacementDocument_tenantId_noteId_createdAt_idx"
  ON reinsurance."PlacementDocument"("tenantId", "noteId", "createdAt");

CREATE INDEX "PlacementDocument_tenantId_endorsementId_createdAt_idx"
  ON reinsurance."PlacementDocument"("tenantId", "endorsementId", "createdAt");

CREATE INDEX "PlacementDocument_tenantId_endorsementClosingId_createdAt_idx"
  ON reinsurance."PlacementDocument"("tenantId", "endorsementClosingId", "createdAt");

CREATE INDEX "PlacementDocument_tenantId_claimId_createdAt_idx"
  ON reinsurance."PlacementDocument"("tenantId", "claimId", "createdAt");

CREATE INDEX "PlacementDocument_tenantId_claimCashCallId_createdAt_idx"
  ON reinsurance."PlacementDocument"("tenantId", "claimCashCallId", "createdAt");

ALTER TABLE reinsurance."PlacementDocument"
  ADD CONSTRAINT "PlacementDocument_placementId_tenantId_fkey"
  FOREIGN KEY ("placementId", "tenantId")
  REFERENCES reinsurance."Placement"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementDocument"
  ADD CONSTRAINT "PlacementDocument_participantId_fkey"
  FOREIGN KEY ("participantId")
  REFERENCES reinsurance."PlacementParticipant"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementDocument"
  ADD CONSTRAINT "PlacementDocument_closingId_fkey"
  FOREIGN KEY ("closingId")
  REFERENCES reinsurance."PlacementClosing"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementDocument"
  ADD CONSTRAINT "PlacementDocument_noteId_fkey"
  FOREIGN KEY ("noteId")
  REFERENCES reinsurance."PlacementNote"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementDocument"
  ADD CONSTRAINT "PlacementDocument_endorsementId_fkey"
  FOREIGN KEY ("endorsementId")
  REFERENCES reinsurance."PlacementEndorsement"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementDocument"
  ADD CONSTRAINT "PlacementDocument_endorsementClosingId_fkey"
  FOREIGN KEY ("endorsementClosingId")
  REFERENCES reinsurance."PlacementEndorsementClosing"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementDocument"
  ADD CONSTRAINT "PlacementDocument_claimId_fkey"
  FOREIGN KEY ("claimId")
  REFERENCES reinsurance."PlacementClaim"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE reinsurance."PlacementDocument"
  ADD CONSTRAINT "PlacementDocument_claimCashCallId_fkey"
  FOREIGN KEY ("claimCashCallId")
  REFERENCES reinsurance."PlacementClaimCashCall"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
