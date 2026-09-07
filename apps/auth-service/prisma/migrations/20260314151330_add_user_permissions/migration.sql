-- CreateEnum
CREATE TYPE "w_auth"."PermissionEffect" AS ENUM ('GRANT', 'REVOKE');

-- CreateTable
CREATE TABLE "w_auth"."UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" "w_auth"."PermissionEffect" NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permission_key" ON "w_auth"."UserPermission"("userId", "permission");

-- AddForeignKey
ALTER TABLE "w_auth"."UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "w_auth"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "w_auth"."UserPermission" ADD CONSTRAINT "UserPermission_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "w_auth"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
