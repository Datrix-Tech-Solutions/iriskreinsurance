import { PlacementPayment } from '@/types/reinsurance';

export interface PremiumForeignSettlement {
  /** Currency the cedant actually settled the premium in. */
  currency: string;
  /** Obligation-currency units per 1 unit of `currency` (obligation = settlement × rate). */
  rate: number;
}

/**
 * When every confirmed, non-reversed premium receipt on a placement settled in the *same*
 * single currency — different from the obligation currency — at the *same* rate, return that
 * currency + rate. Any mix (some in the obligation currency, multiple foreign currencies, or
 * differing rates) returns null, and callers should stay in the obligation currency.
 */
export function premiumForeignSettlement(
  payments: PlacementPayment[] | undefined,
  obligationCurrency: string | null | undefined,
): PremiumForeignSettlement | null {
  const receipts = (payments ?? []).filter(
    (p) => p.type === 'PREMIUM_RECEIVED' && p.status === 'BANK_CONFIRMED' && !p.reversalOfPaymentId,
  );
  if (receipts.length === 0) return null;

  const currency = receipts[0].settlementCurrency;
  const rateStr = receipts[0].agreedExchangeRate;
  if (!currency || !rateStr) return null;

  const rate = parseFloat(rateStr);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (obligationCurrency && currency === obligationCurrency) return null;

  const allMatch = receipts.every(
    (p) => p.settlementCurrency === currency && p.agreedExchangeRate === rateStr,
  );
  return allMatch ? { currency, rate } : null;
}
