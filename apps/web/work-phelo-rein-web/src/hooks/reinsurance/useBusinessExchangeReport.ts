import { reinsuranceReportsKey, reportFilterCsv } from '@/lib/reinsurance/reportCache';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api';

const BUSINESS_EXCHANGE_REPORT_BASE = '/operations/reinsurance/reports/business-exchange';

export type BusinessExchangeMode = 'monthly' | 'yearly';

export interface BusinessExchangeReportParams {
  mode?: BusinessExchangeMode;
  /** Monthly: the year (defaults server-side to the current year). Yearly: omit for all years. */
  year?: number;
  /** Monthly only: omit for all months. */
  month?: number;
  currencies?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?:
    | 'insuranceCompany'
    | 'period'
    | 'volumeGiven'
    | 'volumeReceived'
    | 'businessReceived'
    | 'netBalance'
    | 'netBrokerage';
  sortOrder?: 'asc' | 'desc';
}

export interface BusinessExchangeReportRow {
  insuranceCompany: string;
  currency: string;
  /** YYYY-MM in monthly mode, YYYY in yearly mode. */
  period: string;
  volumeGiven: number;
  volumeReceived: number;
  businessReceived: number;
  netBalance: number;
  netBrokerage: number;
}

export interface BusinessExchangeCurrencyTotals {
  currency: string;
  volumeGiven: number;
  volumeReceived: number;
  businessReceived: number;
  netBalance: number;
  netBrokerage: number;
}

export interface BusinessExchangeReportSummary {
  companyCount: number;
  totalsByCurrency: BusinessExchangeCurrencyTotals[];
}

export interface BusinessExchangeReportMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BusinessExchangeReportResponse {
  items: BusinessExchangeReportRow[];
  summary: BusinessExchangeReportSummary;
  meta: BusinessExchangeReportMeta;
}

function normalizeParams(params: BusinessExchangeReportParams = {}) {
  const mode = params.mode ?? 'monthly';
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    mode,
    ...(params.year !== undefined ? { year: params.year } : {}),
    ...(mode === 'monthly' && params.month !== undefined ? { month: params.month } : {}),
    ...(params.currencies?.length ? { currency: reportFilterCsv(params.currencies) } : {}),
    ...(params.search ? { search: params.search } : {}),
    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
  };
}

export const businessExchangeReportKey = (params: BusinessExchangeReportParams = {}) =>
  [...reinsuranceReportsKey, 'business-exchange', normalizeParams(params)] as const;

export function useBusinessExchangeReport(
  params: BusinessExchangeReportParams,
  options: { enabled?: boolean } = {},
): Pick<UseQueryResult<BusinessExchangeReportResponse>, 'isError' | 'error' | 'refetch'> & {
  rows: BusinessExchangeReportRow[];
  summary: BusinessExchangeReportSummary;
  meta: BusinessExchangeReportMeta;
  isLoading: boolean;
} {
  const normalizedParams = normalizeParams(params);
  const result = useQuery({
    queryKey: businessExchangeReportKey(params),
    queryFn: async ({ signal }) => {
      const res = await api.get<BusinessExchangeReportResponse>(BUSINESS_EXCHANGE_REPORT_BASE, {
        signal,
        params: normalizedParams,
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });

  return {
    rows: result.data?.items ?? [],
    summary: result.data?.summary ?? { companyCount: 0, totalsByCurrency: [] },
    meta: result.data?.meta ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      total: 0,
      totalPages: 0,
    },
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

export async function downloadBusinessExchangeReportCsv(
  params: BusinessExchangeReportParams,
): Promise<Blob> {
  const res = await api.get<Blob>(`${BUSINESS_EXCHANGE_REPORT_BASE}/export.csv`, {
    params: normalizeParams({ ...params, page: undefined, limit: undefined }),
    responseType: 'blob',
  });
  return res.data;
}

export async function downloadBusinessExchangeReportExcel(
  params: BusinessExchangeReportParams,
): Promise<Blob> {
  const res = await api.get<Blob>(`${BUSINESS_EXCHANGE_REPORT_BASE}/export.xls`, {
    params: normalizeParams({ ...params, page: undefined, limit: undefined }),
    responseType: 'blob',
  });
  return res.data;
}
