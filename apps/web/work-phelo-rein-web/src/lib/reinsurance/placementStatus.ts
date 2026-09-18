import {
  Facultative,
  FacultativeStatus,
  PlacementPayment,
  toStatusLabel,
} from '@/types/reinsurance';

export type StatusVariant = 'success' | 'warning' | 'neutral' | 'danger';

export const RAW_STATUS_VARIANT_MAP: Record<FacultativeStatus, StatusVariant> = {
  DRAFT: 'neutral',
  MARKETING: 'neutral',
  PARTIALLY_PLACED: 'success',
  PLACED: 'success',
  CLOSING: 'success',
  CLOSED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'danger',
};

export function acceptedPercentFor(placement: Facultative): number {
  return (
    placement.participants
      ?.filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED')
      .reduce((sum, p) => sum + parseFloat(p.signedLinePercent ?? p.sharePercent ?? '0'), 0) ?? 0
  );
}

export function isEffectivelyClosed(placement: Facultative): boolean {
  if (
    placement.status === 'CLOSED' ||
    placement.status === 'DECLINED' ||
    placement.status === 'CANCELLED'
  ) {
    return true;
  }
  if (placement.status === 'CLOSING') {
    const facOffer = placement.facultativeOffer ?? 0;
    return facOffer > 0 && acceptedPercentFor(placement) >= facOffer;
  }
  return false;
}

export function rawStatusLabel(status: FacultativeStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const STATUS_LABEL_OVERRIDES: Partial<Record<FacultativeStatus, string>> = {
  MARKETING: 'On Market',
  CLOSING: 'Partially Closed',
};

export function facultativeStatusLabel(status: FacultativeStatus): string {
  return STATUS_LABEL_OVERRIDES[status] ?? rawStatusLabel(status);
}

export type CedantPaymentStatus = 'Outstanding' | 'Pending' | 'Part Payment' | 'Paid';

export function pendingPremiumReceived(payments: PlacementPayment[]): number {
  return payments
    .filter(
      (p) => p.type === 'PREMIUM_RECEIVED' && p.status === 'RECORDED' && !p.reversalOfPaymentId,
    )
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
}

export function cedantPaymentStatusFromPosition(
  due: number,
  paid: number,
  outstanding: number,
  pendingReceived: number,
): CedantPaymentStatus {
  if (due > 0 && outstanding <= 0.0001) return 'Paid';
  if (paid > 0) return 'Part Payment';
  if (pendingReceived > 0.0001) return 'Pending';
  return 'Outstanding';
}

export const PREMIUM_PAYMENT_STATUS_TEXT: Record<CedantPaymentStatus, string> = {
  Paid: 'Premium fully paid',
  'Part Payment': 'Premium partly paid',
  Pending: 'Premium payment pending',
  Outstanding: 'Premium not yet paid',
};

export function latestConfirmedPremiumPaymentDate(payments: PlacementPayment[]): string | null {
  const received = payments.filter((p) => p.type === 'PREMIUM_RECEIVED' && !p.reversalOfPaymentId);
  return received.reduce<string | null>(
    (latest, p) => (!latest || p.createdAt > latest ? p.createdAt : latest),
    null,
  );
}

/** Earliest premium payment date on the placement — the first time the cedant paid
 *  premium (non-reversed PREMIUM_RECEIVED), by value date. */
export function firstPremiumPaymentDate(payments: PlacementPayment[]): string | null {
  const received = payments.filter((p) => p.type === 'PREMIUM_RECEIVED' && !p.reversalOfPaymentId);
  return received.reduce<string | null>(
    (earliest, p) => (!earliest || p.paymentDate < earliest ? p.paymentDate : earliest),
    null,
  );
}

export function displayStatusFor(placement: Facultative): {
  label: string;
  variant: StatusVariant;
} {
  if (placement.status === 'PARTIALLY_PLACED' || placement.status === 'CLOSING') {
    return isEffectivelyClosed(placement)
      ? { label: 'Closed', variant: 'success' }
      : { label: 'Partially Placed', variant: 'success' };
  }
  return {
    label: toStatusLabel(placement.status),
    variant: RAW_STATUS_VARIANT_MAP[placement.status],
  };
}
