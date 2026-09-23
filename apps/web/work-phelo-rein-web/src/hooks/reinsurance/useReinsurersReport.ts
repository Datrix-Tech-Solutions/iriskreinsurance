import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CedantPaymentStatus } from '@/lib/reinsurance/placementStatus';
import { FacultativeStatus } from '@/types/reinsurance';
import { ReportCurrencyTotals } from './useReportCurrencyTotals';

const REINSURERS_REPORT_BASE = '/operations/reinsurance/reports/reinsurers';

export interface ReinsurersReportParams {
  /** Restricts to placements whose inceptionDate (period of insurance start) falls in [startDate, endDate]. */
  startDate?: string;
  endDate?: string;
  riskTypeIds?: string[];
  /** Row filter — include only placements in these currencies (native currency, no conversion). */
  currencies?: string[];
  statuses?: FacultativeStatus[];
  paymentStatuses?: CedantPaymentStatus[];
  reinsurerIds?: string[];
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'placementCount' | 'cededPremium' | 'outstanding' | 'pending';
  sortOrder?: 'asc' | 'desc';
}

export interface ReinsurerCurrencyAmount {
  currency: string;
  amount: number;
}

export interface ReinsurerReportRow {
  reinsurerId: string;
  name: string;
  placementCount: number;
  participantCount: number;
  cededPremiumByCurrency: ReinsurerCurrencyAmount[];
  payableByCurrency: ReinsurerCurrencyAmount[];
  disbursedByCurrency: ReinsurerCurrencyAmount[];
  outstandingByCurrency: ReinsurerCurrencyAmount[];
  pendingByCurrency: ReinsurerCurrencyAmount[];
  /** Backwards-compatible aggregate for sorting and simple UI surfaces; do not combine unlike currencies in display. */
  cededPremium: number;
  payable: number;
  disbursed: number;
  outstanding: number;
  pending: number;
}

export interface ReinsurersReportCurrencyTotals {
  currency: string;
  placementCount: number;
  participantCount: number;
  sumInsured: number;
  cededPremium: number;
  brokerage: number;
  commission: number;
  payable: number;
  disbursed: number;
  outstanding: number;
  pending: number;
}

export interface ReinsurersReportSummary {
  activeReinsurers: number;
  totalPlacements: number;
  totalParticipants: number;
  reinsurersWithOutstanding: number;
  totalsByCurrency: ReinsurersReportCurrencyTotals[];
}

export interface ReinsurersReportMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ReinsurersReportResponse {
  items: ReinsurerReportRow[];
  summary: ReinsurersReportSummary;
  meta: ReinsurersReportMeta;
}

function normalizeReinsurersReportParams(params: ReinsurersReportParams = {}) {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    ...(params.startDate ? { dateFrom: params.startDate } : {}),
    ...(params.endDate ? { dateTo: params.endDate } : {}),
    ...(params.riskTypeIds?.length ? { riskTypeId: params.riskTypeIds.join(',') } : {}),
    ...(params.currencies?.length ? { currency: params.currencies.join(',') } : {}),
    ...(params.statuses?.length ? { placementStatus: params.statuses.join(',') } : {}),
    ...(params.paymentStatuses?.length ? { paymentStatus: params.paymentStatuses.join(',') } : {}),
    ...(params.reinsurerIds?.length ? { reinsurerId: params.reinsurerIds.join(',') } : {}),
    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
  };
}

function totalsByCode(
  totals: ReinsurersReportCurrencyTotals[],
  key: keyof Pick<
    ReinsurersReportCurrencyTotals,
    'sumInsured' | 'cededPremium' | 'brokerage' | 'commission'
  >,
): Map<string, number> {
  return totals.reduce<Map<string, number>>((acc, row) => {
    if (Math.abs(row[key]) > 0.0001) acc.set(row.currency, row[key]);
    return acc;
  }, new Map<string, number>());
}

function toCurrencyTotals(summary: ReinsurersReportSummary | undefined): ReportCurrencyTotals {
  const totals = summary?.totalsByCurrency ?? [];
  return {
    sumInsured: totalsByCode(totals, 'sumInsured'),
    premium: totalsByCode(totals, 'cededPremium'),
    brokerage: totalsByCode(totals, 'brokerage'),
    commission: totalsByCode(totals, 'commission'),
    nicLevy: new Map<string, number>(),
    wht: new Map<string, number>(),
    isLoading: false,
  };
}

export const reinsurersReportKey = (params: ReinsurersReportParams = {}) =>
  ['reinsurance', 'reports', 'reinsurers', normalizeReinsurersReportParams(params)] as const;

export function useReinsurersReport(
  params: ReinsurersReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: ReinsurerReportRow[];
  summary: ReinsurersReportSummary;
  meta: ReinsurersReportMeta;
  currencyTotals: ReportCurrencyTotals;
  isLoading: boolean;
} {
  const normalizedParams = normalizeReinsurersReportParams(params);
  const result = useQuery({
    queryKey: reinsurersReportKey(params),
    queryFn: async () => {
      const res = await api.get<ReinsurersReportResponse>(REINSURERS_REPORT_BASE, {
        params: normalizedParams,
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });

  const summary = result.data?.summary ?? {
    activeReinsurers: 0,
    totalPlacements: 0,
    totalParticipants: 0,
    reinsurersWithOutstanding: 0,
    totalsByCurrency: [],
  };

  return {
    rows: result.data?.items ?? [],
    summary,
    meta: result.data?.meta ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      total: 0,
      totalPages: 0,
    },
    currencyTotals: toCurrencyTotals(summary),
    isLoading: result.isLoading,
  };
}

export async function downloadReinsurersReportCsv(params: ReinsurersReportParams): Promise<Blob> {
  const res = await api.get<Blob>(`${REINSURERS_REPORT_BASE}/export.csv`, {
    params: normalizeReinsurersReportParams({ ...params, page: undefined, limit: undefined }),
    responseType: 'blob',
  });
  return res.data;
}

export async function downloadReinsurersReportExcel(params: ReinsurersReportParams): Promise<Blob> {
  const res = await api.get<Blob>(`${REINSURERS_REPORT_BASE}/export.xls`, {
    params: normalizeReinsurersReportParams({ ...params, page: undefined, limit: undefined }),
    responseType: 'blob',
  });
  return res.data;
}
