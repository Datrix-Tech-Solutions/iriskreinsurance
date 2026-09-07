-- CreateEnum
CREATE TYPE "notify"."NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "notify"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "notify"."NotificationType" AS ENUM ('EMAIL_VERIFICATION', 'INVITE_USER', 'PASSWORD_RESET_LINK', 'PASSWORD_RESET_OTP', 'SMS_OTP', 'PUSH_GENERAL');

-- CreateTable
CREATE TABLE "notify"."NotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "type" "notify"."NotificationType" NOT NULL,
    "channel" "notify"."NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "status" "notify"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);
