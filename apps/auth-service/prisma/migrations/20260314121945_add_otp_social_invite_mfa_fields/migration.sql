/*
  Warnings:

  - A unique constraint covering the columns `[inviteToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "w_auth"."OtpType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'MFA_SMS');

-- CreateEnum
CREATE TYPE "w_auth"."SocialProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "w_auth"."MfaMethod" AS ENUM ('TOTP', 'SMS');

-- AlterTable
ALTER TABLE "w_auth"."RefreshToken" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "deviceName" TEXT;

-- AlterTable
ALTER TABLE "w_auth"."User" ADD COLUMN     "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "mfaMethod" "w_auth"."MfaMethod",
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "w_auth"."OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "w_auth"."OtpType" NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "w_auth"."SocialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "w_auth"."SocialProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_provider_providerId_key" ON "w_auth"."SocialAccount"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteToken_key" ON "w_auth"."User"("inviteToken");

-- AddForeignKey
ALTER TABLE "w_auth"."OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "w_auth"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "w_auth"."SocialAccount" ADD CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "w_auth"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
