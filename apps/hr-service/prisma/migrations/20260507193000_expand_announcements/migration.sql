CREATE TYPE "hr"."AnnouncementAudienceType" AS ENUM ('ALL', 'DEPARTMENTS', 'BRANCHES', 'EMPLOYEES');

ALTER TABLE "hr"."Announcement"
ADD COLUMN "audienceType" "hr"."AnnouncementAudienceType" NOT NULL DEFAULT 'ALL',
ADD COLUMN "targetDepartmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "targetBranchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "targetEmployeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "sendEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "hr"."Announcement"
SET "publishedAt" = "createdAt"
WHERE "publishedAt" IS NULL;

CREATE INDEX "Announcement_tenantId_publishedAt_idx"
ON "hr"."Announcement"("tenantId", "publishedAt");

CREATE INDEX "Announcement_tenantId_expiresAt_idx"
ON "hr"."Announcement"("tenantId", "expiresAt");

CREATE INDEX "Announcement_tenantId_audienceType_idx"
ON "hr"."Announcement"("tenantId", "audienceType");
