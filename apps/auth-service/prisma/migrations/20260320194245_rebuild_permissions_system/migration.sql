/*
  Warnings:

  - You are about to drop the column `createdAt` on the `UserPermission` table. All the data in the column will be lost.
  - You are about to drop the column `effect` on the `UserPermission` table. All the data in the column will be lost.
  - You are about to drop the column `permission` on the `UserPermission` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `UserPermission` table. All the data in the column will be lost.
  - You are about to drop the `CompanyRolePermission` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,resourceId,action]` on the table `UserPermission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `action` to the `UserPermission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resourceId` to the `UserPermission` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "w_auth"."PermissionAction" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'RUN', 'EXPORT', 'ASSIGN');

-- DropForeignKey
ALTER TABLE "w_auth"."CompanyRolePermission" DROP CONSTRAINT "CompanyRolePermission_companyRoleId_fkey";

-- DropIndex
DROP INDEX "w_auth"."UserPermission_userId_permission_key";

-- AlterTable
ALTER TABLE "w_auth"."UserPermission" DROP COLUMN "createdAt",
DROP COLUMN "effect",
DROP COLUMN "permission",
DROP COLUMN "reason",
ADD COLUMN     "action" "w_auth"."PermissionAction" NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "resourceId" TEXT NOT NULL,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedBy" TEXT;

-- DropTable
DROP TABLE "w_auth"."CompanyRolePermission";

-- DropEnum
DROP TYPE "w_auth"."PermissionEffect";

-- CreateTable
CREATE TABLE "w_auth"."Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "w_auth"."PermissionSet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "w_auth"."PermissionSetResource" (
    "id" TEXT NOT NULL,
    "permissionSetId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" "w_auth"."PermissionAction" NOT NULL,

    CONSTRAINT "PermissionSetResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "w_auth"."UserPermissionSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionSetId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermissionSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Resource_name_key" ON "w_auth"."Resource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionSet_tenantId_name_key" ON "w_auth"."PermissionSet"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionSetResource_permissionSetId_resourceId_action_key" ON "w_auth"."PermissionSetResource"("permissionSetId", "resourceId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionSet_userId_permissionSetId_key" ON "w_auth"."UserPermissionSet"("userId", "permissionSetId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_resourceId_action_key" ON "w_auth"."UserPermission"("userId", "resourceId", "action");

-- AddForeignKey
ALTER TABLE "w_auth"."UserPermission" ADD CONSTRAINT "UserPermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "w_auth"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "w_auth"."UserPermission" ADD CONSTRAINT "UserPermission_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "w_auth"."Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "w_auth"."PermissionSet" ADD CONSTRAINT "PermissionSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "w_auth"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "w_auth"."PermissionSetResource" ADD CONSTRAINT "PermissionSetResource_permissionSetId_fkey" FOREIGN KEY ("permissionSetId") REFERENCES "w_auth"."PermissionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "w_auth"."PermissionSetResource" ADD CONSTRAINT "PermissionSetResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "w_auth"."Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "w_auth"."UserPermissionSet" ADD CONSTRAINT "UserPermissionSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "w_auth"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "w_auth"."UserPermissionSet" ADD CONSTRAINT "UserPermissionSet_permissionSetId_fkey" FOREIGN KEY ("permissionSetId") REFERENCES "w_auth"."PermissionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
