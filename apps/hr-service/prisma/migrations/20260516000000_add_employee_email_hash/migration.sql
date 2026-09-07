-- Phase 1 field-level encryption prep: HMAC companion column for Employee.email.
-- No unique constraint yet — populated by the backfill script, constraint added in Phase 3.
ALTER TABLE "hr"."Employee" ADD COLUMN "emailHash" TEXT;
