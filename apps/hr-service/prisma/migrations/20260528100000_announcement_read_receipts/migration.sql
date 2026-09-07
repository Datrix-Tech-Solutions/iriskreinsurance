-- Track announcement read state per tenant/user without changing announcement
-- visibility semantics.
CREATE TABLE "hr"."AnnouncementReadReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnnouncementReadReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnouncementReadReceipt_tenantId_announcementId_userId_key"
ON "hr"."AnnouncementReadReceipt"("tenantId", "announcementId", "userId");

CREATE INDEX "AnnouncementReadReceipt_tenantId_userId_readAt_idx"
ON "hr"."AnnouncementReadReceipt"("tenantId", "userId", "readAt");

CREATE INDEX "AnnouncementReadReceipt_tenantId_userId_announcementId_idx"
ON "hr"."AnnouncementReadReceipt"("tenantId", "userId", "announcementId");

ALTER TABLE "hr"."AnnouncementReadReceipt"
ADD CONSTRAINT "AnnouncementReadReceipt_announcementId_fkey"
FOREIGN KEY ("announcementId") REFERENCES "hr"."Announcement"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
