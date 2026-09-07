-- CreateEnum
CREATE TYPE "notify"."InAppNotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "notify"."InAppNotification" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "tenantId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB,
    "entityType" TEXT,
    "entityId" TEXT,
    "sourceService" TEXT,
    "priority" "notify"."InAppNotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InAppNotification_eventId_key" ON "notify"."InAppNotification"("eventId");

-- CreateIndex
CREATE INDEX "InAppNotification_tenantId_recipientUserId_isRead_createdAt_idx" ON "notify"."InAppNotification"("tenantId", "recipientUserId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "InAppNotification_tenantId_recipientUserId_archivedAt_idx" ON "notify"."InAppNotification"("tenantId", "recipientUserId", "archivedAt");

-- CreateIndex
CREATE INDEX "InAppNotification_tenantId_type_idx" ON "notify"."InAppNotification"("tenantId", "type");

-- CreateIndex
CREATE INDEX "InAppNotification_tenantId_entityType_entityId_idx" ON "notify"."InAppNotification"("tenantId", "entityType", "entityId");

-- Backfill existing HR-owned in-app notifications if the HR schema/table exists in
-- the same database. The insert itself is intentionally idempotent via eventId, so
-- a recovered deployment can safely re-run just this backfill block if needed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'hr'
      AND table_name = 'Notification'
  ) THEN
    INSERT INTO "notify"."InAppNotification" (
      "id",
      "eventId",
      "tenantId",
      "recipientUserId",
      "type",
      "title",
      "message",
      "link",
      "metadata",
      "sourceService",
      "isRead",
      "readAt",
      "createdAt"
    )
    SELECT
      n."id",
      'hr-notification:' || n."id",
      n."tenantId",
      n."userId",
      n."type",
      initcap(replace(lower(n."type"), '_', ' ')),
      n."message",
      n."link",
      jsonb_build_object('legacyHrNotificationId', n."id"),
      'hr-service',
      n."isRead",
      n."readAt",
      n."createdAt"
    FROM "hr"."Notification" n
    ON CONFLICT ("eventId") DO NOTHING;
  END IF;
END $$;
