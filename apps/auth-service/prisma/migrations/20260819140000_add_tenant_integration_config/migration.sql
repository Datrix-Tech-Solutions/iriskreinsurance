-- Tenant module relationships are explicit. New tenants start disconnected.
ALTER TABLE "w_auth"."Tenant"
  ADD COLUMN IF NOT EXISTS "integrationConfig" JSONB NOT NULL DEFAULT '{}';

-- Preserve the legacy effective behaviour for existing tenants that had both
-- Reinsurance and Accounting enabled before explicit integration configuration.
UPDATE "w_auth"."Tenant"
SET "integrationConfig" = COALESCE("integrationConfig", '{}'::jsonb) ||
  '{"operations.reinsurance->accounting": true}'::jsonb
WHERE COALESCE(("moduleConfig" ->> 'operations')::boolean, false)
  AND COALESCE(("featureConfig" -> 'operations' ->> 'reinsurance')::boolean, false)
  AND COALESCE(("moduleConfig" ->> 'accounting')::boolean, false)
  AND NOT COALESCE("integrationConfig" ? 'operations.reinsurance->accounting', false);
