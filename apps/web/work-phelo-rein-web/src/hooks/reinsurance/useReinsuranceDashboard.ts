import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrencies } from '@/hooks/reinsurance/useCurrencies';
import { useFacultatives } from '@/hooks/reinsurance/useFacultatives';
import { Currency, Facultative } from '@/types/reinsurance';
import { Period, periodWindow } from '@/components/atoms/PeriodToggle';

const DASHBOARD_BASE = '/operations/reinsurance/dashboard';

const dashboardKey = ['reinsurance', 'dashboard'] as const;
const dashboardOverviewKey = [...dashboardKey, 'overview'] as const;
const dashboardPlacementsKey = [...dashboardKey, 'placements'] as const;
const dashboardFinancialsKey = [...dashboardKey, 'financials'] as const;
const dashboardClaimsKey = [...dashboardKey, 'claims'] as const;

export interface DashboardStats {
  totalOffers: number;
  placedOffers: number;
  partiallyClosedOffers: number;
  closedOffers: number;
  closedRate: number;
  trends: {
    totalOffers: number;
    placedOffers: number;
    partiallyClosedOffers: number;
    closedOffers: number;
    closedRate: number;
  };
  previous: {
    totalOffers: number;
    placedOffers: number;
    partiallyClosedOffers: number;
    closedOffers: number;
    closedRate: number;
  };
}

export interface FinancialStats {
  totalRisk: number;
  totalPremium: number;
  totalBrokerage: number;
  currencySymbol: string;
  trends: {
    totalRisk: number;
    totalPremium: number;
    totalBrokerage: number;
  };
  previous: {
    totalRisk: number;
    totalPremium: number;
    totalBrokerage: number;
  };
}

export interface PremiumTrendPoint {
  month: string;
  amount: number;
}

export interface ClaimsTrendPoint {
  month: string;
  claimsIncurred: number;
}

export interface FinancialsByCurrency {
  totalRisk: Map<string, number>;
  sumInsured: Map<string, number>;
  premium: Map<string, number>;
  brokerage: Map<string, number>;
  claimsIncurred: Map<string, number>;
  recoveries: Map<string, number>;
  outstandingPremium: Map<string, number>;
}

interface DashboardCurrencyBreakdown {
  currency: string;
  amount: number;
}

interface DashboardOverviewResponse {
  activePlacements: number;
  closedPlacements: number;
  lockedPlacements: number;
  endorsementsPending: number;
  claimsOpen: number;
  warnings: string[];
}

interface DashboardPlacementsResponse {
  placementCount: number;
  totalCapacity: number;
  acceptedCapacity: number;
  pendingCapacity: number;
  confirmedClosingCapacity: number;
  placementsMissingTarget: number;
  warnings: string[];
}

interface DashboardFinancialsResponse {
  grossPremium: number;
  netPremium: number;
  brokerage: number;
  commission: number;
  paid: number;
  outstanding: number;
  grossPremiumByCurrency: DashboardCurrencyBreakdown[];
  netPremiumByCurrency: DashboardCurrencyBreakdown[];
  paidByCurrency: DashboardCurrencyBreakdown[];
  outstandingByCurrency: DashboardCurrencyBreakdown[];
  noteCounts: {
    draft: number;
    issued: number;
    void: number;
  };
  warnings: string[];
}

interface DashboardClaimsResponse {
  claimsCount: number;
  openClaims: number;
  estimatedLoss: number;
  finalLoss: number;
  allocatedLiability: number;
  claimsIncurredByCurrency: DashboardCurrencyBreakdown[];
  recoveriesByCurrency: DashboardCurrencyBreakdown[];
  cashCallsIssued: number;
  cashCallsPaid: number;
  cashCallsPending: number;
  cashCallCounts: {
    draft: number;
    issued: number;
    paid: number;
  };
  warnings: string[];
}

function useDashboardOverview() {
  return useQuery({
    queryKey: dashboardOverviewKey,
    queryFn: async () => {
      const res = await api.get<DashboardOverviewResponse>(`${DASHBOARD_BASE}/overview`);
      return res.data;
    },
  });
}

function useDashboardPlacements() {
  return useQuery({
    queryKey: dashboardPlacementsKey,
    queryFn: async () => {
      const res = await api.get<DashboardPlacementsResponse>(`${DASHBOARD_BASE}/placements`);
      return res.data;
    },
  });
}

function useDashboardFinancials() {
  return useQuery({
    queryKey: dashboardFinancialsKey,
    queryFn: async () => {
      const res = await api.get<DashboardFinancialsResponse>(`${DASHBOARD_BASE}/financials`);
      return res.data;
    },
  });
}

function useDashboardClaims(window: { since?: string; until?: string } = {}) {
  const { since, until } = window;
  return useQuery({
    queryKey: [...dashboardClaimsKey, { since: since ?? null, until: until ?? null }],
    queryFn: async () => {
      const res = await api.get<DashboardClaimsResponse>(`${DASHBOARD_BASE}/claims`, {
        params: {
          ...(since ? { since } : {}),
          ...(until ? { until } : {}),
        },
      });
      return res.data;
    },
  });
}

/** ISO window for the dashboard period toggle, matching `periodWindow`. */
function claimsWindow(period: Period, year?: number): { since: string; until: string } {
  const { start, end } = periodWindow(period, { year });
  return { since: start.toISOString(), until: end.toISOString() };
}

/**
 * Memoised {@link claimsWindow}. `periodWindow` derives `end` from `new Date()` for every
 * running period, so calling `claimsWindow` inline in a render produces a fresh `until`
 * timestamp each time — which lands in the React Query key and makes `useDashboardClaims`
 * re-mount on every render (permanent `isLoading`, endless refetches). Recompute only when
 * `period` / `year` actually change.
 */
function useClaimsWindow(period: Period, year?: number): { since: string; until: string } {
  return useMemo(() => claimsWindow(period, year), [period, year]);
}

/**
 * `start` / `end` / `prevStart` for the selected period. `year` applies only when
 * `period` is `'yearly'` (from the dashboard year dropdown); for every other case, and for
 * the running year, `end` is "now" so behaviour is unchanged.
 */
function periodBounds(
  period: Period,
  now: Date,
  year?: number,
): { start: Date; end: Date; prevStart: Date } {
  return periodWindow(period, { year, now });
}

function computeStats(items: Facultative[]) {
  const total = items.length;
  const placed = items.filter((f) => ['PARTIALLY_PLACED', 'PLACED'].includes(f.status)).length;
  const partiallyClosed = items.filter((f) => f.status === 'CLOSING').length;
  const closed = items.filter((f) => f.status === 'CLOSED').length;
  const closedRate = total > 0 ? (closed / total) * 100 : 0;
  return { total, placed, partiallyClosed, closed, closedRate };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const change = ((current - previous) / previous) * 100;
  return Math.min(Math.max(change, -100), 100);
}

function getRate(currencies: Currency[], isoCode: string | null): number {
  if (!isoCode) return 1;
  const c = currencies.find((x) => x.isoCode === isoCode);
  return c?.exchangeRateToBase ? parseFloat(c.exchangeRateToBase) : 1;
}

function convertToTarget(
  value: number | null,
  sourceIso: string | null,
  currencies: Currency[],
  targetRate: number,
): number {
  if (value == null) return 0;
  const sourceRate = getRate(currencies, sourceIso);
  return (value * sourceRate) / targetRate;
}

function computeFinancials(items: Facultative[], currencies: Currency[], targetRate: number) {
  let totalRisk = 0;
  let totalPremium = 0;
  let totalBrokerage = 0;

  for (const f of items) {
    totalRisk += convertToTarget(f.sumInsured, f.currency, currencies, targetRate);
    totalPremium += convertToTarget(f.premium, f.currency, currencies, targetRate);

    if (f.premium != null) {
      const premiumInTarget = convertToTarget(f.premium, f.currency, currencies, targetRate);
      for (const p of f.participants) {
        if (p.status !== 'ACCEPTED' && p.status !== 'CLOSED') continue;
        const share = p.sharePercent != null ? parseFloat(p.sharePercent) : null;
        const fee = p.brokerageFee != null ? parseFloat(p.brokerageFee) : null;
        if (share == null || fee == null) continue;
        totalBrokerage += premiumInTarget * (share / 100) * (fee / 100);
      }
    }
  }

  return { totalRisk, totalPremium, totalBrokerage };
}

function breakdownToMap(rows: DashboardCurrencyBreakdown[] | undefined): Map<string, number> {
  return new Map((rows ?? []).map((row) => [row.currency, row.amount]));
}

function addToMap(map: Map<string, number>, key: string | null | undefined, amount: number) {
  if (!key || amount === 0) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function emptyFinancialsByCurrency(): FinancialsByCurrency {
  return {
    totalRisk: new Map(),
    sumInsured: new Map(),
    premium: new Map(),
    brokerage: new Map(),
    claimsIncurred: new Map(),
    recoveries: new Map(),
    outstandingPremium: new Map(),
  };
}

export function useReinsuranceFinancials({
  period,
  year,
  currency,
}: {
  period: Period;
  year?: number;
  currency: string;
}): { data: FinancialStats; isLoading: boolean } {
  const { data: all = [], isLoading: loadingFac } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCur } = useCurrencies();

  const stats = useMemo<FinancialStats>(() => {
    const now = new Date();
    const { start, end, prevStart } = periodBounds(period, now, year);

    const baseCurrency = currencies.find((c) => c.isBaseCurrency);
    const targetIso = currency || baseCurrency?.isoCode || '';
    const targetRate = getRate(currencies, targetIso);
    const targetCurrency = currencies.find((c) => c.isoCode === targetIso);
    const currencySymbol = targetCurrency?.symbol ?? targetIso;

    const filtered = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= start && t <= end;
    });

    const prevFiltered = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= prevStart && t < start;
    });

    const cur = computeFinancials(filtered, currencies, targetRate);
    const prev = computeFinancials(prevFiltered, currencies, targetRate);

    return {
      ...cur,
      currencySymbol,
      trends: {
        totalRisk: pctChange(cur.totalRisk, prev.totalRisk),
        totalPremium: pctChange(cur.totalPremium, prev.totalPremium),
        totalBrokerage: pctChange(cur.totalBrokerage, prev.totalBrokerage),
      },
      previous: {
        totalRisk: prev.totalRisk,
        totalPremium: prev.totalPremium,
        totalBrokerage: prev.totalBrokerage,
      },
    };
  }, [all, currencies, period, year, currency]);

  return { data: stats, isLoading: loadingFac || loadingCur };
}

export function useReinsurancePremiumPaidPct(_options: { period: Period; currency: string }): {
  pct: number;
  isLoading: boolean;
} {
  void _options;
  const { data, isLoading } = useDashboardFinancials();

  const pct = useMemo(() => {
    const due = data?.netPremium ?? 0;
    const paid = data?.paid ?? 0;
    return due > 0 ? Math.min((paid / due) * 100, 100) : 0;
  }, [data]);

  return { pct, isLoading };
}

export function useReinsurancePremiumTrend({ currency }: { currency: string }): {
  data: PremiumTrendPoint[];
  currencySymbol: string;
  isLoading: boolean;
} {
  const { data: all = [], isLoading: loadingFac } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCur } = useCurrencies();

  const result = useMemo(() => {
    const now = new Date();
    const baseCurrency = currencies.find((c) => c.isBaseCurrency);
    const targetIso = currency || baseCurrency?.isoCode || '';
    const targetRate = getRate(currencies, targetIso);
    const targetCurrency = currencies.find((c) => c.isoCode === targetIso);
    const currencySymbol = targetCurrency?.symbol ?? targetIso;

    const months = Array.from({ length: 12 }, (_, i) => {
      const offset = 11 - i;
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
      return { start, end };
    });

    const data = months.map(({ start, end }) => ({
      month: start.toISOString(),
      amount: all.reduce((sum, f) => {
        const t = new Date(f.createdAt);
        if (t >= start && t < end) {
          return sum + convertToTarget(f.premium, f.currency, currencies, targetRate);
        }
        return sum;
      }, 0),
    }));

    return { data, currencySymbol };
  }, [all, currencies, currency]);

  return { ...result, isLoading: loadingFac || loadingCur };
}

export function useReinsuranceDashboard({ period, year }: { period: Period; year?: number }) {
  const { data: all = [], isLoading } = useFacultatives();
  const { data: overview, isLoading: loadingOverview } = useDashboardOverview();
  const { data: placementTotals } = useDashboardPlacements();

  const stats = useMemo<DashboardStats>(() => {
    const now = new Date();
    const { start, end, prevStart } = periodBounds(period, now, year);

    const current = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= start && t <= end;
    });

    const previous = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= prevStart && t < start;
    });

    const cur = computeStats(current);
    const prev = computeStats(previous);
    const totalOffers =
      cur.total ||
      placementTotals?.placementCount ||
      (overview?.activePlacements ?? 0) + (overview?.closedPlacements ?? 0);
    const closedOffers = cur.closed || overview?.closedPlacements || 0;
    const closedRate = totalOffers > 0 ? (closedOffers / totalOffers) * 100 : 0;

    return {
      totalOffers,
      placedOffers: cur.placed,
      partiallyClosedOffers: cur.partiallyClosed,
      closedOffers,
      closedRate,
      trends: {
        totalOffers: pctChange(cur.total, prev.total),
        placedOffers: pctChange(cur.placed, prev.placed),
        partiallyClosedOffers: pctChange(cur.partiallyClosed, prev.partiallyClosed),
        closedOffers: pctChange(cur.closed, prev.closed),
        closedRate: pctChange(cur.closedRate, prev.closedRate),
      },
      previous: {
        totalOffers: prev.total,
        placedOffers: prev.placed,
        partiallyClosedOffers: prev.partiallyClosed,
        closedOffers: prev.closed,
        closedRate: prev.closedRate,
      },
    };
  }, [all, overview, placementTotals, period, year]);

  return { data: stats, isLoading: isLoading || loadingOverview };
}

export function useReinsuranceClaimStats(options: {
  period: Period;
  currency: string;
  year?: number;
}): {
  totalClaims: number;
  totalAmount: number;
  recoveriesAmount: number;
  outstandingAmount: number;
  prevTotalAmount: number;
  trend: number;
  paidPct: number;
  isLoading: boolean;
} {
  const { currency } = options;
  const { data, isLoading } = useDashboardClaims(useClaimsWindow(options.period, options.year));

  // Per-selected-currency figures; fall back to the global loss totals for the
  // claims-incurred number when no currency row matches.
  const incurredForCurrency = data?.claimsIncurredByCurrency?.find(
    (row) => row.currency === currency,
  )?.amount;
  const globalIncurred =
    data?.finalLoss && data.finalLoss > 0 ? data.finalLoss : (data?.estimatedLoss ?? 0);
  const totalAmount = incurredForCurrency ?? globalIncurred;

  const recoveriesAmount =
    data?.recoveriesByCurrency?.find((row) => row.currency === currency)?.amount ?? 0;
  const outstandingAmount = Math.max(totalAmount - recoveriesAmount, 0);

  const paidPct =
    data?.cashCallsIssued && data.cashCallsIssued > 0
      ? Math.min((data.cashCallsPaid / data.cashCallsIssued) * 100, 100)
      : 0;

  return {
    totalClaims: data?.claimsCount ?? 0,
    totalAmount,
    recoveriesAmount,
    outstandingAmount,
    prevTotalAmount: 0,
    trend: 0,
    paidPct,
    isLoading,
  };
}

export function useReinsuranceClaimsTrend(_options: { currency: string }): {
  data: ClaimsTrendPoint[];
  currencySymbol: string;
  isLoading: boolean;
} {
  void _options;
  const { isLoading } = useDashboardClaims();

  const data = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const offset = 11 - i;
      return {
        month: new Date(now.getFullYear(), now.getMonth() - offset, 1).toISOString(),
        claimsIncurred: 0,
      };
    });
  }, []);

  return { data, currencySymbol: '', isLoading };
}

export function useReinsuranceClaimRatio(_options: { period: Period; currency: string }): {
  ratio: number;
  trend: number;
  prevRatio: number;
  isLoading: boolean;
} {
  void _options;
  const { data: financials, isLoading: loadingFinancials } = useDashboardFinancials();
  const { data: claims, isLoading: loadingClaims } = useDashboardClaims();

  const claimsTotal =
    claims?.finalLoss && claims.finalLoss > 0 ? claims.finalLoss : (claims?.estimatedLoss ?? 0);
  const premium = financials?.grossPremium ?? 0;
  const ratio = premium > 0 ? Math.min((claimsTotal / premium) * 100, 100) : 0;

  return {
    ratio,
    trend: 0,
    prevRatio: 0,
    isLoading: loadingFinancials || loadingClaims,
  };
}

/** Native-currency financial breakdown, backed by aggregate dashboard endpoints where available. */
export function useReinsuranceFinancialsByCurrency({
  period,
  year,
}: {
  period: Period;
  year?: number;
}): {
  data: FinancialsByCurrency;
  isLoading: boolean;
} {
  const { data: all = [], isLoading: loadingFac } = useFacultatives();
  const { data: financials, isLoading: loadingFinancials } = useDashboardFinancials();
  const { data: claims, isLoading: loadingClaims } = useDashboardClaims(
    useClaimsWindow(period, year),
  );

  const data = useMemo(() => {
    const { start, end } = periodBounds(period, new Date(), year);
    const maps = emptyFinancialsByCurrency();

    all.forEach((f) => {
      if (f.currency == null) return;
      const createdAt = new Date(f.createdAt);
      if (createdAt < start || createdAt > end) return;

      if (f.sumInsured != null) {
        addToMap(maps.sumInsured, f.currency, f.sumInsured);
        if (f.facultativeOffer != null) {
          addToMap(maps.totalRisk, f.currency, f.sumInsured * (f.facultativeOffer / 100));
        }
      }

      if (f.premium != null) {
        for (const p of f.participants) {
          if (p.status !== 'ACCEPTED' && p.status !== 'CLOSED') continue;
          const share = p.sharePercent != null ? parseFloat(p.sharePercent) : null;
          const fee = p.brokerageFee != null ? parseFloat(p.brokerageFee) : null;
          if (share == null || fee == null) continue;
          addToMap(maps.brokerage, f.currency, f.premium * (share / 100) * (fee / 100));
        }
      }
    });

    return {
      ...maps,
      premium: breakdownToMap(financials?.grossPremiumByCurrency),
      outstandingPremium: breakdownToMap(financials?.outstandingByCurrency),
      claimsIncurred: breakdownToMap(claims?.claimsIncurredByCurrency),
      recoveries: breakdownToMap(claims?.recoveriesByCurrency),
    };
  }, [all, financials, claims, period, year]);

  const isLoading = loadingFac || loadingFinancials || loadingClaims;

  return { data, isLoading };
}
