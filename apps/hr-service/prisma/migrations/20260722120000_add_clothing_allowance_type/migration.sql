-- Add CLOTHING allowance type (already supported by the DTO validator and UI, missing from the DB enum).

ALTER TYPE "hr"."AllowanceType" ADD VALUE IF NOT EXISTS 'CLOTHING';
