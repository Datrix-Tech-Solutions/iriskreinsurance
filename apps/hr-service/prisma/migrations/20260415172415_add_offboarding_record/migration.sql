-- CreateEnum
CREATE TYPE "hr"."OffboardReason" AS ENUM ('RESIGNATION', 'TERMINATION', 'CONTRACT_ENDED', 'RETIREMENT', 'REDUNDANCY', 'OTHER');

-- CreateTable
CREATE TABLE "hr"."OffboardingRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" "hr"."OffboardReason" NOT NULL,
    "otherReason" TEXT,
    "lastWorkingDate" TIMESTAMP(3) NOT NULL,
    "exitNotes" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "completedByEmail" TEXT,
    "assetReturnDone" BOOLEAN NOT NULL DEFAULT false,
    "assetReturnDoneById" TEXT,
    "assetReturnDoneByEmail" TEXT,
    "assetReturnDoneAt" TIMESTAMP(3),
    "hrClearanceDone" BOOLEAN NOT NULL DEFAULT false,
    "hrClearanceDoneById" TEXT,
    "hrClearanceDoneByEmail" TEXT,
    "hrClearanceDoneAt" TIMESTAMP(3),
    "financeClearanceDone" BOOLEAN NOT NULL DEFAULT false,
    "financeClearanceDoneById" TEXT,
    "financeClearanceDoneByEmail" TEXT,
    "financeClearanceDoneAt" TIMESTAMP(3),
    "managerApprovalDone" BOOLEAN NOT NULL DEFAULT false,
    "managerApprovalDoneById" TEXT,
    "managerApprovalDoneByEmail" TEXT,
    "managerApprovalDoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffboardingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OffboardingRecord_employeeId_key" ON "hr"."OffboardingRecord"("employeeId");

-- AddForeignKey
ALTER TABLE "hr"."OffboardingRecord" ADD CONSTRAINT "OffboardingRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
