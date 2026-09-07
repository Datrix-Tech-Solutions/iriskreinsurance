-- CreateEnum
CREATE TYPE "hr"."AppraisalCycleStatus" AS ENUM ('UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "hr"."AppraisalReminderType" AS ENUM (
    'SELF_7_DAYS',
    'SELF_3_DAYS',
    'SELF_DUE',
    'MANAGER_7_DAYS',
    'MANAGER_3_DAYS',
    'MANAGER_DUE'
);

-- AlterTable
ALTER TABLE "hr"."AppraisalTemplate"
ALTER COLUMN "selfAssessmentWeight" SET DEFAULT 40,
ALTER COLUMN "managerAssessmentWeight" SET DEFAULT 60;

-- AlterTable
ALTER TABLE "hr"."AppraisalCycle"
ADD COLUMN     "selfAssessmentWeight" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "managerAssessmentWeight" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "status" "hr"."AppraisalCycleStatus" NOT NULL DEFAULT 'UPCOMING',
ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledReason" TEXT,
ALTER COLUMN "isActive" SET DEFAULT false;

UPDATE "hr"."AppraisalCycle" cycle
SET
  "selfAssessmentWeight" = COALESCE(template."selfAssessmentWeight", 40),
  "managerAssessmentWeight" = COALESCE(template."managerAssessmentWeight", 60),
  "status" = CASE
    WHEN cycle."isActive" = true THEN 'IN_PROGRESS'::"hr"."AppraisalCycleStatus"
    ELSE 'UPCOMING'::"hr"."AppraisalCycleStatus"
  END
FROM "hr"."AppraisalTemplate" template
WHERE cycle."templateId" = template."id";

UPDATE "hr"."AppraisalCycle"
SET "status" = CASE
  WHEN "isActive" = true THEN 'IN_PROGRESS'::"hr"."AppraisalCycleStatus"
  ELSE 'UPCOMING'::"hr"."AppraisalCycleStatus"
END
WHERE "templateId" IS NULL;

-- AlterTable
ALTER TABLE "hr"."Appraisal"
ALTER COLUMN "selfScore" TYPE DOUBLE PRECISION USING "selfScore"::DOUBLE PRECISION,
ALTER COLUMN "managerScore" TYPE DOUBLE PRECISION USING "managerScore"::DOUBLE PRECISION,
ALTER COLUMN "finalScore" TYPE DOUBLE PRECISION USING "finalScore"::DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "hr"."TenantConfig"
ADD COLUMN     "outstandingThreshold" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "veryGoodThreshold" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "goodThreshold" INTEGER NOT NULL DEFAULT 70,
ADD COLUMN     "satisfactoryThreshold" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "hr"."AppraisalReminderLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appraisalId" TEXT NOT NULL,
    "reminderType" "hr"."AppraisalReminderType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppraisalReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalTemplate_tenantId_name_key" ON "hr"."AppraisalTemplate"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalCycle_tenantId_title_key" ON "hr"."AppraisalCycle"("tenantId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalReminderLog_appraisalId_reminderType_key" ON "hr"."AppraisalReminderLog"("appraisalId", "reminderType");

-- AddForeignKey
ALTER TABLE "hr"."AppraisalReminderLog" ADD CONSTRAINT "AppraisalReminderLog_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "hr"."Appraisal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
