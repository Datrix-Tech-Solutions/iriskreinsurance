CREATE TYPE "reinsurance"."PlacementAttachmentStatus" AS ENUM ('ACTIVE', 'VOID');

CREATE TABLE "reinsurance"."PlacementAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "participantId" TEXT,
    "closingId" TEXT,
    "endorsementId" TEXT,
    "endorsementParticipantId" TEXT,
    "endorsementClosingId" TEXT,
    "claimId" TEXT,
    "claimCashCallId" TEXT,
    "paymentId" TEXT,
    "status" "reinsurance"."PlacementAttachmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "description" TEXT,
    "originalFileName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementAttachment_id_tenantId_key" ON "reinsurance"."PlacementAttachment"("id", "tenantId");
CREATE INDEX "PlacementAttachment_tenantId_placementId_status_createdAt_idx" ON "reinsurance"."PlacementAttachment"("tenantId", "placementId", "status", "createdAt");
CREATE INDEX "PlacementAttachment_tenantId_participantId_status_createdAt_idx" ON "reinsurance"."PlacementAttachment"("tenantId", "participantId", "status", "createdAt");
CREATE INDEX "PlacementAttachment_tenantId_closingId_status_createdAt_idx" ON "reinsurance"."PlacementAttachment"("tenantId", "closingId", "status", "createdAt");
CREATE INDEX "PlacementAttachment_tenantId_endorsementId_status_createdAt_idx" ON "reinsurance"."PlacementAttachment"("tenantId", "endorsementId", "status", "createdAt");
CREATE INDEX "PlacementAttachment_tenantId_endorsementParticipantId_status_createdAt_idx" ON "reinsurance"."PlacementAttachment"("tenantId", "endorsementParticipantId", "status", "createdAt");
CREATE INDEX "PlacementAttachment_tenantId_endorsementClosingId_status_createdAt_idx" ON "reinsurance"."PlacementAttachment"("tenantId", "endorsementClosingId", "status", "createdAt");
CREATE INDEX "PlacementAttachment_tenantId_claimId_status_createdAt_idx" ON "reinsurance"."PlacementAttachment"("tenantId", "claimId", "status", "createdAt");
CREATE INDEX "PlacementAttachment_tenantId_claimCashCallId_status_createdAt_idx" ON "reinsurance"."PlacementAttachment"("tenantId", "claimCashCallId", "status", "createdAt");
CREATE INDEX "PlacementAttachment_tenantId_paymentId_status_createdAt_idx" ON "reinsurance"."PlacementAttachment"("tenantId", "paymentId", "status", "createdAt");

ALTER TABLE "reinsurance"."PlacementAttachment" ADD CONSTRAINT "PlacementAttachment_placementId_tenantId_fkey" FOREIGN KEY ("placementId", "tenantId") REFERENCES "reinsurance"."Placement"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reinsurance"."PlacementAttachment" ADD CONSTRAINT "PlacementAttachment_participantId_tenantId_fkey" FOREIGN KEY ("participantId", "tenantId") REFERENCES "reinsurance"."PlacementParticipant"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reinsurance"."PlacementAttachment" ADD CONSTRAINT "PlacementAttachment_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "reinsurance"."PlacementClosing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reinsurance"."PlacementAttachment" ADD CONSTRAINT "PlacementAttachment_endorsementId_tenantId_fkey" FOREIGN KEY ("endorsementId", "tenantId") REFERENCES "reinsurance"."PlacementEndorsement"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reinsurance"."PlacementAttachment" ADD CONSTRAINT "PlacementAttachment_endorsementParticipantId_tenantId_fkey" FOREIGN KEY ("endorsementParticipantId", "tenantId") REFERENCES "reinsurance"."PlacementEndorsementParticipant"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reinsurance"."PlacementAttachment" ADD CONSTRAINT "PlacementAttachment_endorsementClosingId_tenantId_fkey" FOREIGN KEY ("endorsementClosingId", "tenantId") REFERENCES "reinsurance"."PlacementEndorsementClosing"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reinsurance"."PlacementAttachment" ADD CONSTRAINT "PlacementAttachment_claimId_tenantId_fkey" FOREIGN KEY ("claimId", "tenantId") REFERENCES "reinsurance"."PlacementClaim"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reinsurance"."PlacementAttachment" ADD CONSTRAINT "PlacementAttachment_claimCashCallId_tenantId_fkey" FOREIGN KEY ("claimCashCallId", "tenantId") REFERENCES "reinsurance"."PlacementClaimCashCall"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reinsurance"."PlacementAttachment" ADD CONSTRAINT "PlacementAttachment_paymentId_tenantId_fkey" FOREIGN KEY ("paymentId", "tenantId") REFERENCES "reinsurance"."PlacementPayment"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
