-- AlterTable
ALTER TABLE "hr"."Employee" ADD COLUMN     "statusChangedAt" TIMESTAMP(3),
ADD COLUMN     "statusChangedByEmail" TEXT,
ADD COLUMN     "statusChangedById" TEXT;
