export interface PaymentReversalCandidate {
  id: string;
  type: string;
  status: string;
  reversalOfPaymentId: string | null;
}

export function canReversePayment(payment: PaymentReversalCandidate): boolean {
  if (payment.reversalOfPaymentId) return false;
  if (payment.type === 'REINSURER_DISBURSEMENT') {
    return payment.status === 'BANK_CONFIRMED';
  }
  if (payment.type === 'PREMIUM_RECEIVED') {
    return payment.status === 'BANK_CONFIRMED';
  }
  return payment.status === 'RECORDED';
}

/** A reinsurer disbursement that still represents money out — i.e. not itself a reversal entry
 * and not in a terminal REVERSED/CANCELLED/FAILED state. */
export function isActiveReinsurerDisbursement(payment: PaymentReversalCandidate): boolean {
  return (
    payment.type === 'REINSURER_DISBURSEMENT' &&
    !payment.reversalOfPaymentId &&
    payment.status !== 'REVERSED' &&
    payment.status !== 'CANCELLED' &&
    payment.status !== 'FAILED'
  );
}

/**
 * A premium receipt can only be reversed once every reinsurer disbursement it funded has been
 * reversed first — otherwise the placement would show money paid out against a premium that no
 * longer exists. Returns true when reversal of `payment` must be blocked for that reason.
 */
export function premiumReversalBlockedByDisbursements(
  payment: PaymentReversalCandidate,
  placementPayments: PaymentReversalCandidate[],
): boolean {
  if (payment.type !== 'PREMIUM_RECEIVED') return false;
  return placementPayments.some(isActiveReinsurerDisbursement);
}

export function paymentReversalRequest(placementId: string, payment: PaymentReversalCandidate) {
  return { placementId, paymentId: payment.id };
}
