import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchPlacementNotes, facultativePlacementNotesKey } from './useFacultatives';
import { useCurrencies } from './useCurrencies';
import { usePremiumsReport, PremiumsReportParams } from './usePremiumsReport';
import { Currency, PlacementNote } from '@/types/reinsurance';

const num = (v: string | number | null | undefined): number | null =>
  v == null ? null : typeof v === 'number' ? v : parseFloat(v);

function currencyRate(currencies: Currency[], isoCode: string | null): number | null {
  if (!isoCode) return null;
  const c = currencies.find((x) => x.isoCode === isoCode);
  if (!c) return null;
  if (c.isBaseCurrency) return 1;
  return c.exchangeRateToBase ? parseFloat(c.exchangeRateToBase) : null;
}

export type BrokerageReportParams = PremiumsReportParams;

/** One reinsurer's brokerage / tax figures, realised against premium collected. */
export interface BrokerageReinsurerRow {
  reinsurerId: string;
  reinsurerName: string;
  /** Fac premium share (closing gross premium). */
  grossPremium: number | null;
  /** Total brokerage on this reinsurer's share. */
  brokerageAmount: number | null;
  /** Brokerage realised on the collected share of premium. */
  brokeragePaid: number | null;
  withholdingTax: number | null;
  withholdingTaxPaid: number | null;
  nicLevy: number | null;
  nicLevyPaid: number | null;
}

export interface BrokerageReportRow {
  id: string;
  policyNumber: string;
  title: string;
  cedantName: string;
  policyType: string | null;
  inceptionDate: string | null;
  expiryDate: string | null;
  currency: string | null;
  sumInsured: number | null;
  premium: number | null;
  /** Obligation-currency units per 1 unit of base currency. */
  exchangeRate: number | null;
  /** Premium collected ÷ premium due, clamped to [0, 1] — brokerage accrues on this share. */
  collectionRatio: number;
  reinsurers: BrokerageReinsurerRow[];
}

/**
 * Brokerage the broker earns on **paid** premium. Builds on usePremiumsReport
 * (placement + per-reinsurer closing + cedant due/paid), keeps only placements
 * where premium has been collected, then attaches each reinsurer's brokerage /
 * WHT / NIC levy from its broker-to-reinsurer credit note (backend-computed),
 * pro-rated by how much of the premium has actually been paid.
 */
export function useBrokerageReport(
  params: BrokerageReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: BrokerageReportRow[];
  isLoading: boolean;
} {
  const enabled = options.enabled ?? true;
  const { rows: premiumRows, isLoading: loadingPremiums } = usePremiumsReport(params, options);
  const { data: currencies = [], isLoading: loadingCurrencies } = useCurrencies();

  // Only placements with premium actually collected — brokerage is cash-basis.
  const paidRows = useMemo(
    () => (enabled ? premiumRows.filter((r) => r.paid > 0.01) : []),
    [premiumRows, enabled],
  );

  const noteQueries = useQueries({
    queries: paidRows.map((r) => ({
      queryKey: facultativePlacementNotesKey(r.id),
      queryFn: () => fetchPlacementNotes(r.id),
      enabled,
    })),
  });

  const notesByPlacementId = useMemo(() => {
    const map = new Map<string, PlacementNote[]>();
    paidRows.forEach((r, i) => {
      const data = noteQueries[i]?.data;
      if (data) map.set(r.id, data);
    });
    return map;
  }, [paidRows, noteQueries]);

  const rows = useMemo<BrokerageReportRow[]>(() => {
    return paidRows.map((r) => {
      const collectionRatio = r.due > 0.01 ? Math.min(1, Math.max(0, r.paid / r.due)) : 1;
      const notes = notesByPlacementId.get(r.id) ?? [];

      // The reinsurer's credit note carries that closing's brokerage / WHT / NIC
      // (backend-computed, foreign vs. local already applied). Matched by closing,
      // falling back to counterparty when a note predates closing linkage.
      const creditNoteFor = (closingId: string, counterpartyId: string) =>
        notes.find(
          (n) =>
            n.type === 'CREDIT_NOTE' &&
            n.status !== 'VOID' &&
            !n.voidedAt &&
            (n.closingId === closingId ||
              (n.closingId == null && n.counterpartyId === counterpartyId)),
        );

      const reinsurers: BrokerageReinsurerRow[] = r.reinsurers.map((re) => {
        const note = creditNoteFor(re.closingId, re.reinsurerId);
        // Note is authoritative; fall back to the closing's snapshotted brokerage.
        const brokerageAmount = num(note?.brokerageAmount) ?? re.brokerageAmount;
        const withholdingTax = num(note?.withholdingTaxAmount);
        const nicLevy = num(note?.nicLevyAmount);
        const paid = (v: number | null) => (v == null ? null : v * collectionRatio);
        return {
          reinsurerId: re.reinsurerId,
          reinsurerName: re.reinsurerName,
          grossPremium: re.grossPremium,
          brokerageAmount,
          brokeragePaid: paid(brokerageAmount),
          withholdingTax,
          withholdingTaxPaid: paid(withholdingTax),
          nicLevy,
          nicLevyPaid: paid(nicLevy),
        };
      });

      return {
        id: r.id,
        policyNumber: r.policyNumber,
        title: r.title,
        cedantName: r.cedantName,
        policyType: r.policyType,
        inceptionDate: r.inceptionDate,
        expiryDate: r.expiryDate,
        currency: r.currency,
        sumInsured: r.sumInsured,
        premium: r.premium,
        exchangeRate: currencyRate(currencies, r.currency),
        collectionRatio,
        reinsurers,
      };
    });
  }, [paidRows, notesByPlacementId, currencies]);

  const isLoading = loadingPremiums || loadingCurrencies || noteQueries.some((q) => q.isLoading);

  return { rows, isLoading };
}
