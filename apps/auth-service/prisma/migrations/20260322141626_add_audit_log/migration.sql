-- CreateEnum
CREATE TYPE "w_auth"."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REVOKE', 'LOGIN', 'LOGOUT', 'EXPORT', 'ASSIGN', 'RUN');

-- CreateEnum
CREATE TYPE "w_auth"."AuditStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "w_auth"."AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "action" "w_auth"."AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" "w_auth"."AuditStatus" NOT NULL DEFAULT 'SUCCESS',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "w_auth"."AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_resource_idx" ON "w_auth"."AuditLog"("tenantId", "resource");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_userId_idx" ON "w_auth"."AuditLog"("tenantId", "userId");
