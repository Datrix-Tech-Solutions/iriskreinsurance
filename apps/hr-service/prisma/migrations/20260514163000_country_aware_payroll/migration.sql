CREATE TYPE "hr"."PayrollCountry" AS ENUM ('GH', 'NG', 'KE');

ALTER TABLE "hr"."TenantConfig"
ADD COLUMN "payrollCountry" "hr"."PayrollCountry" NOT NULL DEFAULT 'GH',
ADD COLUMN "payrollCurrency" TEXT NOT NULL DEFAULT 'GHS';

ALTER TABLE "hr"."PayrollRun"
ADD COLUMN "payrollCountry" "hr"."PayrollCountry" NOT NULL DEFAULT 'GH',
ADD COLUMN "payrollCurrency" TEXT NOT NULL DEFAULT 'GHS';
