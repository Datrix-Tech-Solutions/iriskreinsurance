import { PlacementClaimCedantSettlement, PlacementClaimStatus } from '@/types/reinsurance';

/** Mirrors the backend's claim status state machine (placement-claims.service.ts). */
export const CLAIM_STATUS_TRANSITIONS: Record<PlacementClaimStatus, PlacementClaimStatus[]> = {
  DRAFT: ['NOTIFIED', 'DECLINED', 'VOID'],
  NOTIFIED: ['RESERVED', 'DECLINED', 'VOID'],
  RESERVED: ['PARTIALLY_SETTLED', 'DECLINED'],
  PARTIALLY_SETTLED: ['SETTLED'],
  SETTLED: ['CLOSED'],
  DECLINED: [],
  CLOSED: [],
  VOID: [],
};

export const CLAIM_STATUS_VARIANT: Record<
  PlacementClaimStatus,
  'neutral' | 'warning' | 'success' | 'danger'
> = {
  DRAFT: 'neutral',
  NOTIFIED: 'warning',
  RESERVED: 'warning',
  PARTIALLY_SETTLED: 'warning',
  SETTLED: 'success',
  DECLINED: 'danger',
  CLOSED: 'success',
  VOID: 'danger',
};

export const CLAIM_STATUS_LABEL: Record<PlacementClaimStatus, string> = {
  DRAFT: 'Draft',
  NOTIFIED: 'Notified',
  RESERVED: 'Reserved',
  PARTIALLY_SETTLED: 'Partly Settled',
  SETTLED: 'Settled',
  DECLINED: 'Declined',
  CLOSED: 'Closed',
  VOID: 'Void',
};

export const SETTLEMENT_STATUS_VARIANT: Record<
  PlacementClaimCedantSettlement['status'],
  'neutral' | 'warning' | 'success' | 'danger' | 'info'
> = {
  RECORDED: 'warning',
  BANK_CONFIRMED: 'success',
  REVERSED: 'danger',
};

export const SETTLEMENT_STATUS_LABEL: Record<PlacementClaimCedantSettlement['status'], string> = {
  RECORDED: 'Recorded',
  BANK_CONFIRMED: 'Bank Confirmed',
  REVERSED: 'Reversed',
};

export const FINANCIAL_CLOSE_BLOCKER_LABEL: Record<string, string> = {
  PAYABLE_NOT_APPROVED: 'Cedant payable has not been approved',
  CLAIM_PAYABLE_OUTSTANDING: 'Cedant payable still has an outstanding balance',
  RECOVERY_OUTSTANDING: 'Reinsurer recoveries still have an outstanding balance',
  CEDANT_SETTLEMENT_CONFIRMATION_PENDING: 'A cedant settlement is awaiting bank confirmation',
  RECOVERY_RECEIPT_CONFIRMATION_PENDING: 'A recovery receipt is awaiting bank confirmation',
};
