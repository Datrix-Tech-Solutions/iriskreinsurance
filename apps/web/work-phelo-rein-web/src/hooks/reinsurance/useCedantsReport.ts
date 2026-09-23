import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CedantPaymentStatus } from '@/lib/reinsurance/placementStatus';
import { FacultativeStatus } from '@/types/reinsurance';
import { ReportCurrencyTotals } from './useReportCurrencyTotals';

const CEDANTS_REPORT_BASE = '/operations/reinsurance/reports/cedants';

export interface CedantsReportParams {
  /** Restricts to placements whose inceptionDate (period of insurance start) falls in [startDate, endDate]. */
  startDate?: string;
  endDate?: string;
  riskTypeIds?: string[];
  /** Row filter — include only placements in these currencies (native currency, no conversion). */
  currencies?: string[];
  statuses?: FacultativeStatus[];
  paymentStatuses?: CedantPaymentStatus[];
  cedantIds?: string[];
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'placementCount' | 'totalPremium' | 'outstanding' | 'pending';
  sortOrder?: 'asc' | 'desc';
}

export interface CedantCurrencyAmount {
  currency: string;
  amount: number;
}

export interface CedantReportRow {
  cedantId: string;
  name: string;
  placementCount: number;
  totalPremiumByCurrency: CedantCurrencyAmount[];
  outstandingByCurrency: CedantCurrencyAmount[];
  pendingByCurrency: CedantCurrencyAmount[];
  /** Backwards-compatible aggregate for sorting and simple UI surfaces; do not combine unlike currencies in display. */
  totalPremium: number;
  outstanding: number;
  pending: number;
}

export interface CedantsReportCurrencyTotals {
  currency: string;
  placementCount: number;
  sumInsured: number;
  premium: number;
  brokerage: number;
  commission: number;
  nicLevy: number;
  wht: number;
  totalPremium: number;
  received: number;
  mandatoryDeductions: number;
  effectiveSettlementCredit: number;
  outstanding: number;
  pending: number;
}

export interface CedantsReportSummary {
  activeCedants: number;
  totalPlacements: number;
  cedantsWithOutstanding: number;
  totalsByCurrency: CedantsReportCurrencyTotals[];
}

export interface CedantsReportMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CedantsReportResponse {
  items: CedantReportRow[];
  summary: CedantsReportSummary;
  meta: CedantsReportMeta;
}

function normalizeCedantsReportParams(params: CedantsReportParams = {}) {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    ...(params.startDate ? { dateFrom: params.startDate } : {}),
    ...(params.endDate ? { dateTo: params.endDate } : {}),
    ...(params.riskTypeIds?.length ? { riskTypeId: params.riskTypeIds.join(',') } : {}),
    ...(params.currencies?.length ? { currency: params.currencies.join(',') } : {}),
    ...(params.statuses?.length ? { placementStatus: params.statuses.join(',') } : {}),
    ...(params.paymentStatuses?.length ? { paymentStatus: params.paymentStatuses.join(',') } : {}),
    ...(params.cedantIds?.length ? { cedantId: params.cedantIds.join(',') } : {}),
    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
  };
}

function totalsByCode(
  totals: CedantsReportCurrencyTotals[],
  key: keyof Pick<
    CedantsReportCurrencyTotals,
    'sumInsured' | 'premium' | 'brokerage' | 'commission' | 'nicLevy' | 'wht'
  >,
): Map<string, number> {
  return totals.reduce<Map<string, number>>((acc, row) => {
    if (Math.abs(row[key]) > 0.0001) acc.set(row.currency, row[key]);
    return acc;
  }, new Map<string, number>());
}

function toCurrencyTotals(summary: CedantsReportSummary | undefined): ReportCurrencyTotals {
  const totals = summary?.totalsByCurrency ?? [];
  return {
    sumInsured: totalsByCode(totals, 'sumInsured'),
    premium: totalsByCode(totals, 'premium'),
    brokerage: totalsByCode(totals, 'brokerage'),
    commission: totalsByCode(totals, 'commission'),
    nicLevy: totalsByCode(totals, 'nicLevy'),
    wht: totalsByCode(totals, 'wht'),
    isLoading: false,
  };
}

export const cedantsReportKey = (params: CedantsReportParams = {}) =>
  ['reinsurance', 'reports', 'cedants', normalizeCedantsReportParams(params)] as const;

export function useCedantsReport(
  params: CedantsReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: CedantReportRow[];
  summary: CedantsReportSummary;
  meta: CedantsReportMeta;
  currencyTotals: ReportCurrencyTotals;
  isLoading: boolean;
} {
  const normalizedParams = normalizeCedantsReportParams(params);
  const result = useQuery({
    queryKey: cedantsReportKey(params),
    queryFn: async () => {
      const res = await api.get<CedantsReportResponse>(CEDANTS_REPORT_BASE, {
        params: normalizedParams,
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });

  const summary = result.data?.summary ?? {
    activeCedants: 0,
    totalPlacements: 0,
    cedantsWithOutstanding: 0,
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

export async function downloadCedantsReportCsv(params: CedantsReportParams): Promise<Blob> {
  const res = await api.get<Blob>(`${CEDANTS_REPORT_BASE}/export.csv`, {
    params: normalizeCedantsReportParams({ ...params, page: undefined, limit: undefined }),
    responseType: 'blob',
  });
  return res.data;
}

export async function downloadCedantsReportExcel(params: CedantsReportParams): Promise<Blob> {
  const res = await api.get<Blob>(`${CEDANTS_REPORT_BASE}/export.xls`, {
    params: normalizeCedantsReportParams({ ...params, page: undefined, limit: undefined }),
    responseType: 'blob',
  });
  return res.data;
}
