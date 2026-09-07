import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useFacultatives } from './useFacultatives';
import { useCurrencies } from './useCurrencies';
import { useReportCurrencyTotals, ReportCurrencyTotals } from './useReportCurrencyTotals';
import { Currency, Facultative, FacultativeStatus, PlacementPayment } from '@/types/reinsurance';
import { pendingPremiumReceived } from '@/lib/reinsurance/placementStatus';

const BASE = '/operations/reinsurance/placements';
const paymentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'payments'] as const;
const QUALIFYING_PARTICIPANT_STATUSES = new Set(['ACCEPTED', 'CLOSED']);

function netPremiumFor(p: Facultative): number {
  const fac =
    p.premium != null && p.facultativeOffer != null ? (p.facultativeOffer / 100) * p.premium : 0;
  return p.commission != null ? fac * (1 - p.commission / 100) : fac;
}

/** Only BANK_CONFIRMED receipts count as settled — matches the financial-position/netSettled
 *  convention used everywhere else, so this report's Outstanding agrees with the Payments and
 *  Facultative tables instead of treating a merely-RECORDED (unconfirmed) receipt as paid. */
function totalPaidFor(payments: PlacementPayment[]): number {
  return payments
    .filter(
      (p) =>
        p.type === 'PREMIUM_RECEIVED' && p.status === 'BANK_CONFIRMED' && !p.reversalOfPaymentId,
    )
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

function getRate(currencies: Currency[], isoCode: string | null): number {
  if (!isoCode) return 1;
  const c = currencies.find((x) => x.isoCode === isoCode);
  return c?.exchangeRateToBase ? parseFloat(c.exchangeRateToBase) : 1;
}

function convertToTarget(
  value: number,
  sourceIso: string | null,
  currencies: Currency[],
  targetRate: number,
): number {
  const sourceRate = getRate(currencies, sourceIso);
  return (value * sourceRate) / targetRate;
}

export interface CedantsReportParams {
  /** Restricts to placements whose inceptionDate (period of insurance start) falls in [startDate, endDate]. */
  startDate?: string;
  endDate?: string;
  riskTypeId?: string;
  currency?: string;
  status?: FacultativeStatus;
  cedantIds?: string[];
}

export interface CedantReportRow {
  cedantId: string;
  name: string;
  placementCount: number;
  totalPremium: number;
  outstanding: number;
  /** Recorded but not yet bank-confirmed receipts — already reflected in `outstanding`, just called out separately. */
  pending: number;
}

export interface CedantsReportSummary {
  activeCedants: number;
  totalPlacements: number;
  cedantsWithOutstanding: number;
  totalPremium: number;
  outstanding: number;
  pending: number;
  currencySymbol: string;
}

export function useCedantsReport(
  params: CedantsReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: CedantReportRow[];
  summary: CedantsReportSummary;
  currencyTotals: ReportCurrencyTotals;
  isLoading: boolean;
} {
  const enabled = options.enabled ?? true;
  const { data: placements = [], isLoading: loadingPlacements } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCurrencies } = useCurrencies();

  const filtered = useMemo(() => {
    if (!enabled) return [];

    const from = params.startDate ? new Date(params.startDate) : null;
    const to = params.endDate ? new Date(params.endDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    const cedantIds = params.cedantIds?.length ? new Set(params.cedantIds) : null;

    return placements.filter((p) => {
      if (from || to) {
        if (!p.inceptionDate) return false;
        const inception = new Date(p.inceptionDate);
        if (from && inception < from) return false;
        if (to && inception > to) return false;
      }
      if (params.riskTypeId && p.riskTypeId !== params.riskTypeId) return false;
      if (params.status && p.status !== params.status) return false;
      if (cedantIds && !cedantIds.has(p.cedant.id)) return false;
      return true;
    });
  }, [
    placements,
    enabled,
    params.startDate,
    params.endDate,
    params.riskTypeId,
    params.status,
    params.cedantIds,
  ]);

  const targetIso = useMemo(() => {
    if (params.currency) return params.currency;
    return currencies.find((c) => c.isBaseCurrency)?.isoCode ?? '';
  }, [params.currency, currencies]);
  const targetRate = getRate(currencies, targetIso);

  const payableFiltered = useMemo(() => filtered.filter((p) => netPremiumFor(p) > 0), [filtered]);

  const paymentQueries = useQueries({
    queries: payableFiltered.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const rows = useMemo(() => {
    const map = new Map<string, CedantReportRow>();

    filtered.forEach((p) => {
      const existing = map.get(p.cedant.id) ?? {
        cedantId: p.cedant.id,
        name: p.cedant.name,
        placementCount: 0,
        totalPremium: 0,
        outstanding: 0,
        pending: 0,
      };
      existing.placementCount += 1;
      existing.totalPremium += convertToTarget(
        netPremiumFor(p),
        p.currency,
        currencies,
        targetRate,
      );
      map.set(p.cedant.id, existing);
    });

    payableFiltered.forEach((p, i) => {
      const payments = paymentQueries[i]?.data ?? [];
      const unpaid = Math.max(netPremiumFor(p) - totalPaidFor(payments), 0);
      const entry = map.get(p.cedant.id);
      if (entry) {
        entry.outstanding += convertToTarget(unpaid, p.currency, currencies, targetRate);
        entry.pending += convertToTarget(
          pendingPremiumReceived(payments),
          p.currency,
          currencies,
          targetRate,
        );
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalPremium - a.totalPremium);
  }, [filtered, payableFiltered, paymentQueries, currencies, targetRate]);

  const summary = useMemo<CedantsReportSummary>(() => {
    const targetCurrency = currencies.find((c) => c.isoCode === targetIso);
    return {
      activeCedants: rows.length,
      totalPlacements: rows.reduce((sum, r) => sum + r.placementCount, 0),
      cedantsWithOutstanding: rows.filter((r) => r.outstanding > 0).length,
      totalPremium: rows.reduce((sum, r) => sum + r.totalPremium, 0),
      outstanding: rows.reduce((sum, r) => sum + r.outstanding, 0),
      pending: rows.reduce((sum, r) => sum + r.pending, 0),
      currencySymbol: targetCurrency?.symbol ?? targetIso,
    };
  }, [rows, currencies, targetIso]);

  const isLoading =
    loadingPlacements || loadingCurrencies || paymentQueries.some((q) => q.isLoading);

  const currencyTotalsEntries = useMemo(
    () =>
      filtered.map((p) => ({
        placement: p,
        participants: p.participants.filter((pt) => QUALIFYING_PARTICIPANT_STATUSES.has(pt.status)),
        scope: 'placement' as const,
      })),
    [filtered],
  );
  const currencyTotals = useReportCurrencyTotals(currencyTotalsEntries);

  return { rows, summary, currencyTotals, isLoading };
}
