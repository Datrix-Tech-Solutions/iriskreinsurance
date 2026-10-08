import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrencies } from '@/hooks/reinsurance/useCurrencies';
import { usePremiumsStats } from '@/hooks/reinsurance/usePremiumsReport';
import { Period, periodWindow } from '@/components/atoms/PeriodToggle';

const DASHBOARD_BASE = '/operations/reinsurance/dashboard';

const dashboardKey = ['reinsurance', 'dashboard'] as const;
const dashboardFinancialsKey = [...dashboardKey, 'financials'] as const;
const dashboardClaimsKey = [...dashboardKey, 'claims'] as const;
const dashboardBreakdownsKey = [...dashboardKey, 'breakdowns'] as const;

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
  amountByCurrency: Map<string, number>;
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

interface DashboardTopCounterpartyResponse {
  id: string;
  name: string;
  offerCount: number;
  totalPremiumByCurrency: DashboardCurrencyBreakdown[];
}

interface DashboardRiskClassResponse {
  id: string | null;
  name: string;
  placementCount: number;
  premiumByCurrency: DashboardCurrencyBreakdown[];
  sumInsuredByCurrency: DashboardCurrencyBreakdown[];
}

interface DashboardPremiumTrendResponse {
  month: string;
  amountByCurrency: DashboardCurrencyBreakdown[];
}

interface DashboardBreakdownsResponse {
  offers: DashboardPlacementsResponse & {
    placedOffers: number;
    partiallyClosedOffers: number;
    closedOffers: number;
    closedRate: number;
    previous: {
      placementCount: number;
      placedOffers: number;
      partiallyClosedOffers: number;
      closedOffers: number;
      closedRate: number;
    };
    trends: {
      placementCount: number;
      placedOffers: number;
      partiallyClosedOffers: number;
      closedOffers: number;
      closedRate: number;
    };
  };
  sumInsuredByCurrency: DashboardCurrencyBreakdown[];
  totalRiskByCurrency: DashboardCurrencyBreakdown[];
  grossPremiumByCurrency: DashboardCurrencyBreakdown[];
  riskClasses: DashboardRiskClassResponse[];
  topCedants: DashboardTopCounterpartyResponse[];
  topReinsurers: DashboardTopCounterpartyResponse[];
  premiumTrend: DashboardPremiumTrendResponse[];
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
  brokerageByCurrency: DashboardCurrencyBreakdown[];
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

function useDashboardFinancials(window: { since?: string; until?: string } = {}) {
  const { since, until } = window;
  return useQuery({
    queryKey: [...dashboardFinancialsKey, { since: since ?? null, until: until ?? null }],
    queryFn: async () => {
      const res = await api.get<DashboardFinancialsResponse>(`${DASHBOARD_BASE}/financials`, {
        params: {
          ...(since ? { since } : {}),
          ...(until ? { until } : {}),
        },
      });
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

function useDashboardBreakdowns(window: { since?: string; until?: string } = {}) {
  const { since, until } = window;
  return useQuery({
    queryKey: [...dashboardBreakdownsKey, { since: since ?? null, until: until ?? null }],
    queryFn: async () => {
      const res = await api.get<DashboardBreakdownsResponse>(`${DASHBOARD_BASE}/breakdowns`, {
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

function breakdownToMap(rows: DashboardCurrencyBreakdown[] | undefined): Map<string, number> {
  return new Map((rows ?? []).map((row) => [row.currency, row.amount]));
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

function amountForCurrency(
  rows: Array<{ code?: string; currency?: string; amount: number }> | undefined,
  code: string,
): number {
  return rows?.find((row) => (row.code ?? row.currency) === code)?.amount ?? 0;
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
  const window = useClaimsWindow(period, year);
  const { data: breakdowns, isLoading: loadingBreakdowns } = useDashboardBreakdowns(window);
  const { data: premiumStats, isLoading: loadingPremiumStats } = usePremiumsStats(window);
  const { data: currencies = [], isLoading: loadingCur } = useCurrencies();

  const stats = useMemo<FinancialStats>(() => {
    const baseCurrency = currencies.find((c) => c.isBaseCurrency);
    const targetIso = currency || baseCurrency?.isoCode || '';
    const targetCurrency = currencies.find((c) => c.isoCode === targetIso);
    const currencySymbol = targetCurrency?.symbol ?? targetIso;
    const totalPremium = amountForCurrency(breakdowns?.grossPremiumByCurrency, targetIso);
    const totalRisk = amountForCurrency(breakdowns?.totalRiskByCurrency, targetIso);
    const totalBrokerage = amountForCurrency(premiumStats?.brokerageEarnedByCurrency, targetIso);

    return {
      totalRisk,
      totalPremium,
      totalBrokerage,
      currencySymbol,
      trends: {
        totalRisk: 0,
        totalPremium: 0,
        totalBrokerage: 0,
      },
      previous: {
        totalRisk: 0,
        totalPremium: 0,
        totalBrokerage: 0,
      },
    };
  }, [breakdowns, premiumStats, currencies, currency]);

  return { data: stats, isLoading: loadingBreakdowns || loadingPremiumStats || loadingCur };
}

export function useReinsurancePremiumPaidPct(options: { period: Period; currency: string }): {
  pct: number;
  isLoading: boolean;
} {
  const { data, isLoading } = useDashboardFinancials(useClaimsWindow(options.period));

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
  const { data: breakdowns, isLoading: loadingBreakdowns } = useDashboardBreakdowns();
  const { data: currencies = [], isLoading: loadingCur } = useCurrencies();

  const result = useMemo(() => {
    const baseCurrency = currencies.find((c) => c.isBaseCurrency);
    const targetIso = currency || baseCurrency?.isoCode || '';
    const targetCurrency = currencies.find((c) => c.isoCode === targetIso);
    const currencySymbol = targetCurrency?.symbol ?? targetIso;

    const data =
      breakdowns?.premiumTrend.map((point) => ({
        month: point.month,
        amountByCurrency: breakdownToMap(point.amountByCurrency),
        amount: amountForCurrency(point.amountByCurrency, targetIso),
      })) ?? [];

    return { data, currencySymbol };
  }, [breakdowns, currencies, currency]);

  return { ...result, isLoading: loadingBreakdowns || loadingCur };
}

export function useReinsuranceDashboard({ period, year }: { period: Period; year?: number }) {
  const window = useClaimsWindow(period, year);
  const { data: breakdowns, isLoading } = useDashboardBreakdowns(window);

  const stats = useMemo<DashboardStats>(() => {
    const offers = breakdowns?.offers;

    return {
      totalOffers: offers?.placementCount ?? 0,
      placedOffers: offers?.placedOffers ?? 0,
      partiallyClosedOffers: offers?.partiallyClosedOffers ?? 0,
      closedOffers: offers?.closedOffers ?? 0,
      closedRate: offers?.closedRate ?? 0,
      trends: {
        totalOffers: offers?.trends.placementCount ?? 0,
        placedOffers: offers?.trends.placedOffers ?? 0,
        partiallyClosedOffers: offers?.trends.partiallyClosedOffers ?? 0,
        closedOffers: offers?.trends.closedOffers ?? 0,
        closedRate: offers?.trends.closedRate ?? 0,
      },
      previous: {
        totalOffers: offers?.previous.placementCount ?? 0,
        placedOffers: offers?.previous.placedOffers ?? 0,
        partiallyClosedOffers: offers?.previous.partiallyClosedOffers ?? 0,
        closedOffers: offers?.previous.closedOffers ?? 0,
        closedRate: offers?.previous.closedRate ?? 0,
      },
    };
  }, [breakdowns]);

  return { data: stats, isLoading };
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

  const effectiveCurrency = currency || data?.claimsIncurredByCurrency?.[0]?.currency || '';
  const totalAmount = amountForCurrency(data?.claimsIncurredByCurrency, effectiveCurrency);

  const recoveriesAmount = amountForCurrency(data?.recoveriesByCurrency, effectiveCurrency);
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

export function useReinsuranceRiskClassBreakdown({
  period,
  year,
}: {
  period: Period;
  year?: number;
}): {
  data: DashboardRiskClassResponse[];
  isLoading: boolean;
} {
  const { data, isLoading } = useDashboardBreakdowns(useClaimsWindow(period, year));
  return { data: data?.riskClasses ?? [], isLoading };
}

export function useReinsuranceTopCedants({ period, year }: { period: Period; year?: number }): {
  data: DashboardTopCounterpartyResponse[];
  isLoading: boolean;
} {
  const { data, isLoading } = useDashboardBreakdowns(useClaimsWindow(period, year));
  return { data: data?.topCedants ?? [], isLoading };
}

export function useReinsuranceTopReinsurers({ period, year }: { period: Period; year?: number }): {
  data: DashboardTopCounterpartyResponse[];
  isLoading: boolean;
} {
  const { data, isLoading } = useDashboardBreakdowns(useClaimsWindow(period, year));
  return { data: data?.topReinsurers ?? [], isLoading };
}

export function useReinsuranceClaimRatio(options: { period: Period; currency: string }): {
  ratio: number;
  trend: number;
  prevRatio: number;
  isLoading: boolean;
} {
  const window = useClaimsWindow(options.period);
  const { data: financials, isLoading: loadingFinancials } = useDashboardFinancials(window);
  const { data: claims, isLoading: loadingClaims } = useDashboardClaims(window);
  const effectiveCurrency =
    options.currency ||
    financials?.grossPremiumByCurrency?.[0]?.currency ||
    claims?.claimsIncurredByCurrency?.[0]?.currency ||
    '';

  const claimsTotal = amountForCurrency(claims?.claimsIncurredByCurrency, effectiveCurrency);
  const premium = amountForCurrency(financials?.grossPremiumByCurrency, effectiveCurrency);
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
  const window = useClaimsWindow(period, year);
  const { data: breakdowns, isLoading: loadingBreakdowns } = useDashboardBreakdowns(window);
  const { data: financials, isLoading: loadingFinancials } = useDashboardFinancials(window);
  const { data: claims, isLoading: loadingClaims } = useDashboardClaims(window);

  const data = useMemo(() => {
    const maps = emptyFinancialsByCurrency();

    return {
      ...maps,
      sumInsured: breakdownToMap(breakdowns?.sumInsuredByCurrency),
      totalRisk: breakdownToMap(breakdowns?.totalRiskByCurrency),
      premium: breakdownToMap(financials?.grossPremiumByCurrency),
      brokerage: breakdownToMap(financials?.brokerageByCurrency),
      outstandingPremium: breakdownToMap(financials?.outstandingByCurrency),
      claimsIncurred: breakdownToMap(claims?.claimsIncurredByCurrency),
      recoveries: breakdownToMap(claims?.recoveriesByCurrency),
    };
  }, [breakdowns, financials, claims]);

  const isLoading = loadingBreakdowns || loadingFinancials || loadingClaims;

  return { data, isLoading };
}
