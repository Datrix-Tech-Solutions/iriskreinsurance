-- Additive permission registration only; grants and tenant entitlements are unchanged.
ALTER TYPE "w_auth"."PermissionAction" ADD VALUE IF NOT EXISTS 'IMPORT';
