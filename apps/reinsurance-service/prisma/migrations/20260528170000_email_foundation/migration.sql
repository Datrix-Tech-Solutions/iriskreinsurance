-- CreateEnum
CREATE TYPE "reinsurance"."MailboxProvider" AS ENUM ('MICROSOFT_GRAPH', 'GOOGLE_GMAIL');

-- CreateEnum
CREATE TYPE "reinsurance"."MailboxConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "reinsurance"."EmailMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "reinsurance"."MailboxConnection" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" "reinsurance"."MailboxProvider" NOT NULL,
  "emailAddress" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "displayName" TEXT,
  "status" "reinsurance"."MailboxConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "externalMailboxId" TEXT,
  "encryptedAccessToken" TEXT,
  "encryptedRefreshToken" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "syncCursor" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "connectedByUserId" TEXT NOT NULL,
  "archivedByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MailboxConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."EmailThread" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "mailboxConnectionId" TEXT NOT NULL,
  "providerThreadId" TEXT NOT NULL,
  "subject" TEXT,
  "participants" JSONB,
  "lastMessageAt" TIMESTAMP(3),
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
  "archivedByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."EmailMessage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "mailboxConnectionId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "internetMessageId" TEXT,
  "direction" "reinsurance"."EmailMessageDirection" NOT NULL,
  "subject" TEXT,
  "fromEmail" TEXT,
  "fromName" TEXT,
  "toRecipients" JSONB,
  "ccRecipients" JSONB,
  "receivedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "bodyPreview" TEXT,
  "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."EmailAttachmentMetadata" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "providerAttachmentId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT,
  "sizeBytes" INTEGER,
  "isInline" BOOLEAN NOT NULL DEFAULT false,
  "contentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailAttachmentMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reinsurance"."PlacementEmailLink" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "messageId" TEXT,
  "linkedByUserId" TEXT NOT NULL,
  "note" TEXT,
  "archivedByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlacementEmailLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailboxConnection_id_tenantId_key" ON "reinsurance"."MailboxConnection"("id", "tenantId");
CREATE INDEX "MailboxConnection_tenantId_provider_status_archivedAt_idx" ON "reinsurance"."MailboxConnection"("tenantId", "provider", "status", "archivedAt");
CREATE INDEX "MailboxConnection_tenantId_normalizedEmail_archivedAt_idx" ON "reinsurance"."MailboxConnection"("tenantId", "normalizedEmail", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_id_tenantId_key" ON "reinsurance"."EmailThread"("id", "tenantId");
CREATE UNIQUE INDEX "EmailThread_tenantId_mailboxConnectionId_providerThreadId_key" ON "reinsurance"."EmailThread"("tenantId", "mailboxConnectionId", "providerThreadId");
CREATE INDEX "EmailThread_tenantId_mailboxConnectionId_archivedAt_lastMessageAt_idx" ON "reinsurance"."EmailThread"("tenantId", "mailboxConnectionId", "archivedAt", "lastMessageAt");
CREATE INDEX "EmailThread_tenantId_archivedAt_lastMessageAt_idx" ON "reinsurance"."EmailThread"("tenantId", "archivedAt", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_id_tenantId_key" ON "reinsurance"."EmailMessage"("id", "tenantId");
CREATE UNIQUE INDEX "EmailMessage_tenantId_mailboxConnectionId_providerMessageId_key" ON "reinsurance"."EmailMessage"("tenantId", "mailboxConnectionId", "providerMessageId");
CREATE INDEX "EmailMessage_tenantId_threadId_receivedAt_idx" ON "reinsurance"."EmailMessage"("tenantId", "threadId", "receivedAt");
CREATE INDEX "EmailMessage_tenantId_mailboxConnectionId_receivedAt_idx" ON "reinsurance"."EmailMessage"("tenantId", "mailboxConnectionId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAttachmentMetadata_tenantId_messageId_providerAttachmentId_key" ON "reinsurance"."EmailAttachmentMetadata"("tenantId", "messageId", "providerAttachmentId");
CREATE INDEX "EmailAttachmentMetadata_tenantId_messageId_idx" ON "reinsurance"."EmailAttachmentMetadata"("tenantId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementEmailLink_id_tenantId_key" ON "reinsurance"."PlacementEmailLink"("id", "tenantId");
CREATE INDEX "PlacementEmailLink_tenantId_placementId_archivedAt_idx" ON "reinsurance"."PlacementEmailLink"("tenantId", "placementId", "archivedAt");
CREATE INDEX "PlacementEmailLink_tenantId_threadId_archivedAt_idx" ON "reinsurance"."PlacementEmailLink"("tenantId", "threadId", "archivedAt");
CREATE INDEX "PlacementEmailLink_tenantId_messageId_archivedAt_idx" ON "reinsurance"."PlacementEmailLink"("tenantId", "messageId", "archivedAt");

-- AddForeignKey
ALTER TABLE "reinsurance"."EmailThread" ADD CONSTRAINT "EmailThread_mailboxConnectionId_tenantId_fkey" FOREIGN KEY ("mailboxConnectionId", "tenantId") REFERENCES "reinsurance"."MailboxConnection"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reinsurance"."EmailMessage" ADD CONSTRAINT "EmailMessage_mailboxConnectionId_tenantId_fkey" FOREIGN KEY ("mailboxConnectionId", "tenantId") REFERENCES "reinsurance"."MailboxConnection"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reinsurance"."EmailMessage" ADD CONSTRAINT "EmailMessage_threadId_tenantId_fkey" FOREIGN KEY ("threadId", "tenantId") REFERENCES "reinsurance"."EmailThread"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reinsurance"."EmailAttachmentMetadata" ADD CONSTRAINT "EmailAttachmentMetadata_messageId_tenantId_fkey" FOREIGN KEY ("messageId", "tenantId") REFERENCES "reinsurance"."EmailMessage"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reinsurance"."PlacementEmailLink" ADD CONSTRAINT "PlacementEmailLink_placementId_tenantId_fkey" FOREIGN KEY ("placementId", "tenantId") REFERENCES "reinsurance"."Placement"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reinsurance"."PlacementEmailLink" ADD CONSTRAINT "PlacementEmailLink_threadId_tenantId_fkey" FOREIGN KEY ("threadId", "tenantId") REFERENCES "reinsurance"."EmailThread"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
