-- Add participant-scoped endorsement certificate documents.
ALTER TYPE "reinsurance"."PlacementDocumentType"
  ADD VALUE IF NOT EXISTS 'ENDORSEMENT_CERTIFICATE';
