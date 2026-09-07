-- AlterTable
ALTER TABLE "w_auth"."Tenant" ADD COLUMN     "moduleConfig" JSONB NOT NULL DEFAULT '{"hr": false, "accounting": false, "marketing": false}';
