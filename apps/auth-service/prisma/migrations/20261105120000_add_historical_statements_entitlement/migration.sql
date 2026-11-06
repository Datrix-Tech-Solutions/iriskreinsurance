-- Platform entitlement is disabled for every existing and new tenant.
ALTER TABLE "w_auth"."Tenant"
ADD COLUMN "historicalStatementsEnabled" BOOLEAN NOT NULL DEFAULT false;
