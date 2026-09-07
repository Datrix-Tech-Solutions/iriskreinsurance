-- Reinsurance Claims are now financially controlled inside Reinsurance and no
-- longer publish to WorkPhelo Accounting. Preserve delivered historical claim
-- events, but terminalize any undelivered claim outbox rows so they cannot post
-- after this cutover.
UPDATE "reinsurance"."ReinsuranceAccountingOutbox"
SET
  "status" = 'FAILED',
  "nextAttemptAt" = NULL,
  "lastError" = 'Claim Accounting integration retired by product policy',
  "updatedAt" = NOW()
WHERE
  "status" IN ('PENDING', 'PROCESSING', 'FAILED')
  AND "sourceEventType" IN (
    'CLAIM_PAYABLE_APPROVED',
    'CLAIM_RECOVERY_APPROVED',
    'CLAIM_RECOVERY_RECEIVED',
    'CLAIM_RECOVERY_RECEIPT_REVERSED',
    'CLAIM_CEDANT_SETTLEMENT_PAID',
    'CLAIM_CEDANT_SETTLEMENT_REVERSED'
  );
