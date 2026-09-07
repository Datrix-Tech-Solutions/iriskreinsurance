/*
  Warnings:

  - The values [HR_MANAGER,HR_STAFF,ACCOUNTANT,MARKETING_MANAGER,MARKETING_STAFF] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "w_auth"."UserRole_new" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'EMPLOYEE');
ALTER TABLE "w_auth"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "w_auth"."User" ALTER COLUMN "role" TYPE "w_auth"."UserRole_new" USING ("role"::text::"w_auth"."UserRole_new");
ALTER TYPE "w_auth"."UserRole" RENAME TO "UserRole_old";
ALTER TYPE "w_auth"."UserRole_new" RENAME TO "UserRole";
DROP TYPE "w_auth"."UserRole_old";
ALTER TABLE "w_auth"."User" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
COMMIT;

-- AlterTable
ALTER TABLE "w_auth"."User" ADD COLUMN     "companyRoleId" TEXT;

-- CreateTable
CREATE TABLE "w_auth"."CompanyRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "w_auth"."CompanyRolePermission" (
    "id" TEXT NOT NULL,
    "companyRoleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRole_tenantId_name_key" ON "w_auth"."CompanyRole"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRolePermission_companyRoleId_permission_key" ON "w_auth"."CompanyRolePermission"("companyRoleId", "permission");

-- AddForeignKey
ALTER TABLE "w_auth"."CompanyRole" ADD CONSTRAINT "CompanyRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "w_auth"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "w_auth"."CompanyRolePermission" ADD CONSTRAINT "CompanyRolePermission_companyRoleId_fkey" FOREIGN KEY ("companyRoleId") REFERENCES "w_auth"."CompanyRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "w_auth"."User" ADD CONSTRAINT "User_companyRoleId_fkey" FOREIGN KEY ("companyRoleId") REFERENCES "w_auth"."CompanyRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
