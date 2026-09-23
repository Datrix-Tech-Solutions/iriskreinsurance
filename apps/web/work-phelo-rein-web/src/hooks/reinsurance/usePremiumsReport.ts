import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CedantPaymentStatus } from '@/lib/reinsurance/placementStatus';

const PREMIUMS_REPORT_BASE = '/operations/reinsurance/reports/premiums';

export type PremiumReportDateBasis =
  | 'PLACEMENT_CREATED'
  | 'INCEPTION_DATE'
  | 'EXPIRY_DATE'
  | 'CLOSING_CONFIRMED_AT'
  | 'PAYMENT_DATE'
  | 'BANK_CONFIRMED_AT';

export interface PremiumsReportParams {
  /** Restricts placements by the selected date basis. Defaults to inceptionDate. */
  startDate?: string;
  endDate?: string;
  dateBasis?: PremiumReportDateBasis;
  riskTypeIds?: string[];
  currencies?: string[];
  paymentStatuses?: CedantPaymentStatus[];
  cedantIds?: string[];
  /** Offer status — 'closed' keeps only CLOSED placements, 'open' everything else. */
  offerStatus?: 'open' | 'closed';
  page?: number;
  limit?: number;
  sortBy?:
    | 'policyNumber'
    | 'cedantName'
    | 'offerDate'
    | 'dateClosed'
    | 'inceptionDate'
    | 'expiryDate'
    | 'premium'
    | 'grossPremium'
    | 'premiumReceived'
    | 'outstanding'
    | 'paymentStatus';
  sortOrder?: 'asc' | 'desc';
}

export interface PremiumReinsurerBreakdown {
  reinsurerId: string;
  reinsurerName: string;
  closingId: string;
  sharePercent: number | null;
  grossPremium: number | null;
  commissionPercent: number | null;
  commissionAmount: number | null;
  brokerageAmount: number | null;
  netPremium: number | null;
  paidAmount: number;
  outstandingAmount: number | null;
  closedAt: string | null;
}

export interface PremiumReportRow {
  id: string;
  placementId: string;
  reference: string | null;
  policyNumber: string;
  title: string;
  cedantId: string;
  cedantName: string;
  riskClassId: string | null;
  riskClassName: string | null;
  riskTypeId: string | null;
  policyType: string | null;
  status: string;
  offerDate: string | null;
  closedAt: string | null;
  inceptionDate: string | null;
  expiryDate: string | null;
  currency: string | null;
  sumInsured: number | null;
  premium: number | null;
  facultativeOfferPercent: number | null;
  due: number;
  paid: number;
  mandatoryDeductions: number;
  effectiveSettlementCredit: number;
  outstanding: number;
  pending: number;
  paymentStatus: CedantPaymentStatus;
  reinsurers: PremiumReinsurerBreakdown[];
}

export interface PremiumsReportCurrencyTotals {
  currency: string;
  placementCount: number;
  participantCount: number;
  sumInsured: number;
  grossPremium: number;
  commission: number;
  brokerage: number;
  cedantCurrentObligation: number;
  premiumReceived: number;
  mandatoryDeductions: number;
  effectiveSettlementCredit: number;
  cedantOutstanding: number;
  cedantPending: number;
  reinsurerPayable: number;
  reinsurerDisbursed: number;
  reinsurerOutstanding: number;
}

export interface PremiumsReportSummary {
  placementCount: number;
  participantCount: number;
  totalsByCurrency: PremiumsReportCurrencyTotals[];
  /** Backwards-compatible first-currency summary for older report surfaces. */
  totalCollected: number;
  outstanding: number;
  currencySymbol: string;
}

export interface PremiumsReportMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PremiumsStatsCurrencyAmount {
  code: string;
  amount: number;
}

export interface PremiumsStatsTopCedant {
  cedantId: string;
  name: string;
  count: number;
  premiumByCurrency: PremiumsStatsCurrencyAmount[];
}

export interface PremiumsStats {
  dueByCurrency: PremiumsStatsCurrencyAmount[];
  paidByCurrency: PremiumsStatsCurrencyAmount[];
  outstandingByCurrency: PremiumsStatsCurrencyAmount[];
  brokerageEarnedByCurrency: PremiumsStatsCurrencyAmount[];
  collectionRate: number;
  topCedantsByPaidOffers: PremiumsStatsTopCedant[];
}

interface PremiumsReportResponse {
  items: PremiumReportRow[];
  summary: Omit<PremiumsReportSummary, 'totalCollected' | 'outstanding' | 'currencySymbol'>;
  meta: PremiumsReportMeta;
}

function normalizeReportParams(params: PremiumsReportParams = {}) {
  const placementStatus =
    params.offerStatus === 'closed'
      ? ['CLOSED']
      : params.offerStatus === 'open'
        ? ['DRAFT', 'PLACED', 'PARTIALLY_PLACED', 'CLOSING']
        : undefined;

  return {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    dateBasis: params.dateBasis ?? 'INCEPTION_DATE',
    ...(params.startDate ? { dateFrom: params.startDate } : {}),
    ...(params.endDate ? { dateTo: params.endDate } : {}),
    ...(params.riskTypeIds?.length ? { riskTypeId: params.riskTypeIds.join(',') } : {}),
    ...(params.currencies?.length ? { currency: params.currencies.join(',') } : {}),
    ...(params.paymentStatuses?.length ? { paymentStatus: params.paymentStatuses.join(',') } : {}),
    ...(params.cedantIds?.length ? { cedantId: params.cedantIds.join(',') } : {}),
    ...(placementStatus ? { placementStatus: placementStatus.join(',') } : {}),
    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
  };
}

export const premiumsReportKey = (params: PremiumsReportParams = {}) =>
  ['reinsurance', 'reports', 'premiums', normalizeReportParams(params)] as const;

export const premiumsStatsKey = (params: { since: string; until?: string }) =>
  ['reinsurance', 'reports', 'premiums', 'stats', params] as const;

function normalizeSummary(summary: PremiumsReportResponse['summary']): PremiumsReportSummary {
  const firstCurrency = summary.totalsByCurrency[0];
  return {
    ...summary,
    totalCollected: firstCurrency?.premiumReceived ?? 0,
    outstanding: firstCurrency?.cedantOutstanding ?? 0,
    currencySymbol: firstCurrency?.currency ?? '',
  };
}

export function usePremiumsReport(
  params: PremiumsReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: PremiumReportRow[];
  summary: PremiumsReportSummary;
  meta: PremiumsReportMeta;
  isLoading: boolean;
} {
  const normalizedParams = normalizeReportParams(params);
  const result = useQuery({
    queryKey: premiumsReportKey(params),
    queryFn: async () => {
      const res = await api.get<PremiumsReportResponse>(PREMIUMS_REPORT_BASE, {
        params: normalizedParams,
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });

  return {
    rows: result.data?.items ?? [],
    summary: normalizeSummary(
      result.data?.summary ?? {
        placementCount: 0,
        participantCount: 0,
        totalsByCurrency: [],
      },
    ),
    meta: result.data?.meta ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      total: 0,
      totalPages: 0,
    },
    isLoading: result.isLoading,
  };
}

export async function downloadPremiumsReportCsv(params: PremiumsReportParams): Promise<Blob> {
  const res = await api.get<Blob>(`${PREMIUMS_REPORT_BASE}/export.csv`, {
    params: normalizeReportParams({ ...params, page: undefined, limit: undefined }),
    responseType: 'blob',
  });
  return res.data;
}

export async function downloadPremiumsReportExcel(params: PremiumsReportParams): Promise<Blob> {
  const res = await api.get<Blob>(`${PREMIUMS_REPORT_BASE}/export.xls`, {
    params: normalizeReportParams({ ...params, page: undefined, limit: undefined }),
    responseType: 'blob',
  });
  return res.data;
}

export function usePremiumsStats(
  params: { since: string; until?: string },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: premiumsStatsKey(params),
    queryFn: async () => {
      const res = await api.get<PremiumsStats>(`${PREMIUMS_REPORT_BASE}/stats`, {
        params: {
          since: params.since,
          ...(params.until ? { until: params.until } : {}),
        },
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });
}
