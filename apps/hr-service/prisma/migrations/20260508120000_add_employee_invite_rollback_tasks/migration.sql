CREATE TABLE "hr"."EmployeeInviteRollbackTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeInviteRollbackTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeInviteRollbackTask_tenantId_email_key"
ON "hr"."EmployeeInviteRollbackTask"("tenantId", "email");

CREATE INDEX "EmployeeInviteRollbackTask_tenantId_createdAt_idx"
ON "hr"."EmployeeInviteRollbackTask"("tenantId", "createdAt");
