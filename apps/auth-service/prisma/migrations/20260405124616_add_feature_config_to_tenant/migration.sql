-- AlterTable
ALTER TABLE "w_auth"."Tenant" ADD COLUMN     "featureConfig" JSONB NOT NULL DEFAULT '{"hr": {"leave": false, "time": false, "payroll": false, "appraisals": false, "projects": false, "assets": false}, "marketing": {"leads": false, "pipeline": false, "contacts": false}}';
