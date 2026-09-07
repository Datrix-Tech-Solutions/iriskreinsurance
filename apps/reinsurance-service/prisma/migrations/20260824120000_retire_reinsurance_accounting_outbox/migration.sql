-- Reinsurance is now financially self-contained and no longer publishes
-- financial source events to WorkPhelo Accounting. Preserve delivered
-- historical events, but terminalize undelivered rows so stale work cannot
-- post after this cutover.
UPDATE "reinsurance"."ReinsuranceAccountingOutbox"
SET
  "status" = 'FAILED',
  "nextAttemptAt" = NULL,
  "lastError" = 'Reinsurance Accounting integration retired by product policy',
  "updatedAt" = NOW()
WHERE
  "status" IN ('PENDING', 'PROCESSING', 'FAILED')
  AND "sourceEventType" IN (
    'DEBIT_NOTE_ISSUED',
    'CREDIT_NOTE_ISSUED',
    'ENDORSEMENT_DEBIT_NOTE_ISSUED',
    'ENDORSEMENT_CREDIT_NOTE_ISSUED',
    'PREMIUM_PAYMENT_RECEIVED',
    'PAYMENT_REVERSED',
    'REINSURER_DISBURSEMENT_RECORDED',
    'REINSURER_DISBURSEMENT_REVERSED',
    'CLAIM_PAYABLE_APPROVED',
    'CLAIM_RECOVERY_APPROVED',
    'CLAIM_RECOVERY_RECEIVED',
    'CLAIM_RECOVERY_RECEIPT_REVERSED',
    'CLAIM_CEDANT_SETTLEMENT_PAID',
    'CLAIM_CEDANT_SETTLEMENT_REVERSED'
  );
