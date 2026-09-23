import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CedantPaymentStatus } from '@/lib/reinsurance/placementStatus';
import { FacultativeStatus } from '@/types/reinsurance';
import { ReportCurrencyTotals } from './useReportCurrencyTotals';

const FACULTATIVE_REPORT_BASE = '/operations/reinsurance/reports/facultative';

export type FacultativeReportDateField = 'createdAt' | 'premiumPaid' | 'closingDate';
export type FacultativeReportLifecycle = 'ACTIVE' | 'EXPIRED';
export type FacultativeReportScope = 'cedant' | 'reinsurer';

export interface FacultativeReportParams {
  dateField?: FacultativeReportDateField;
  startDate?: string;
  endDate?: string;
  riskClassIds?: string[];
  currencies?: string[];
  statuses?: FacultativeStatus[];
  cedantIds?: string[];
  reinsurerIds?: string[];
  lifecycle?: FacultativeReportLifecycle;
  scope?: FacultativeReportScope;
  paymentStatuses?: CedantPaymentStatus[];
  page?: number;
  limit?: number;
  sortBy?:
    | 'policyNumber'
    | 'cedantName'
    | 'offerDate'
    | 'closedAt'
    | 'inceptionDate'
    | 'expiryDate'
    | 'premium'
    | 'facPremium'
    | 'paymentStatus';
  sortOrder?: 'asc' | 'desc';
}

export interface FacultativeReinsurerBreakdown {
  reinsurerId: string;
  reinsurerName: string;
  sharePercent: number | null;
  closedAt: string | null;
  facSumInsured: number | null;
  facPremium: number | null;
  paidFacPremium: number | null;
  brokerage: number | null;
  brokeragePaid: number | null;
  withholdingTax: number | null;
  withholdingTaxPaid: number | null;
  nicLevy: number | null;
  nicLevyPaid: number | null;
  netPremiumDueReinsurer: number | null;
  netPremiumPaid: number | null;
}

export interface FacultativeCedantFinancials {
  facSumInsured: number | null;
  facPremium: number | null;
  paidFacPremium: number | null;
  cedantCommissionPercent: number | null;
  cedantCommissionAmount: number | null;
  netPremiumDueIrisk: number | null;
  netPremiumDueIriskPaid: number | null;
  brokerage: number | null;
  brokeragePaid: number | null;
  netPremiumDueReinsurer: number | null;
  netPremiumDueReinsurerPaid: number | null;
}

export interface FacultativeReportRow {
  id: string;
  reference: string;
  policyNumber: string | null;
  title: string;
  cedantId: string;
  cedantName: string;
  classOfBusiness: string | null;
  riskClassId: string | null;
  riskClassName: string | null;
  offerDate: string | null;
  closedAt: string | null;
  sumInsured: number | null;
  premium: number | null;
  currency: string | null;
  commission: number | null;
  facultativeOfferPercent: number | null;
  totalOfferedPercent: number;
  totalAcceptedPercent: number;
  reinsurerCount: number;
  status: FacultativeStatus;
  inceptionDate: string | null;
  expiryDate: string | null;
  paymentStatus: CedantPaymentStatus;
  cedantFinancials: FacultativeCedantFinancials;
  reinsurers: FacultativeReinsurerBreakdown[];
}

export interface FacultativeReportCurrencyTotals {
  currency: string;
  placementCount: number;
  participantCount: number;
  sumInsured: number;
  premium: number;
  brokerage: number;
  commission: number;
}

export interface FacultativeReportSummary {
  totalOffers: number;
  openOffers: number;
  acceptanceRate: number;
  totalsByCurrency: FacultativeReportCurrencyTotals[];
}

export interface FacultativeReportMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FacultativeReportResponse {
  items: FacultativeReportRow[];
  summary: FacultativeReportSummary;
  meta: FacultativeReportMeta;
}

function normalizeFacultativeReportParams(params: FacultativeReportParams = {}) {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    dateField: params.dateField ?? 'createdAt',
    ...(params.startDate ? { dateFrom: params.startDate } : {}),
    ...(params.endDate ? { dateTo: params.endDate } : {}),
    ...(params.riskClassIds?.length ? { riskClassId: params.riskClassIds.join(',') } : {}),
    ...(params.currencies?.length ? { currency: params.currencies.join(',') } : {}),
    ...(params.statuses?.length ? { placementStatus: params.statuses.join(',') } : {}),
    ...(params.cedantIds?.length ? { cedantId: params.cedantIds.join(',') } : {}),
    ...(params.reinsurerIds?.length ? { reinsurerId: params.reinsurerIds.join(',') } : {}),
    ...(params.lifecycle ? { lifecycle: params.lifecycle } : {}),
    ...(params.scope ? { scope: params.scope } : {}),
    ...(params.paymentStatuses?.length ? { paymentStatus: params.paymentStatuses.join(',') } : {}),
    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
  };
}

function totalsByCode(
  totals: FacultativeReportCurrencyTotals[],
  key: keyof Pick<
    FacultativeReportCurrencyTotals,
    'sumInsured' | 'premium' | 'brokerage' | 'commission'
  >,
): Map<string, number> {
  return totals.reduce<Map<string, number>>((acc, row) => {
    if (Math.abs(row[key]) > 0.0001) acc.set(row.currency, row[key]);
    return acc;
  }, new Map<string, number>());
}

function toCurrencyTotals(summary: FacultativeReportSummary | undefined): ReportCurrencyTotals {
  const totals = summary?.totalsByCurrency ?? [];
  return {
    sumInsured: totalsByCode(totals, 'sumInsured'),
    premium: totalsByCode(totals, 'premium'),
    brokerage: totalsByCode(totals, 'brokerage'),
    commission: totalsByCode(totals, 'commission'),
    nicLevy: new Map<string, number>(),
    wht: new Map<string, number>(),
    isLoading: false,
  };
}

export const facultativeReportKey = (params: FacultativeReportParams = {}) =>
  ['reinsurance', 'reports', 'facultative', normalizeFacultativeReportParams(params)] as const;

export function useFacultativeReport(
  params: FacultativeReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: FacultativeReportRow[];
  summary: FacultativeReportSummary;
  meta: FacultativeReportMeta;
  currencyTotals: ReportCurrencyTotals;
  isLoading: boolean;
} {
  const normalizedParams = normalizeFacultativeReportParams(params);
  const result = useQuery({
    queryKey: facultativeReportKey(params),
    queryFn: async () => {
      const res = await api.get<FacultativeReportResponse>(FACULTATIVE_REPORT_BASE, {
        params: normalizedParams,
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });

  const summary = result.data?.summary ?? {
    totalOffers: 0,
    openOffers: 0,
    acceptanceRate: 0,
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

export async function downloadFacultativeReportCsv(params: FacultativeReportParams): Promise<Blob> {
  const res = await api.get<Blob>(`${FACULTATIVE_REPORT_BASE}/export.csv`, {
    params: normalizeFacultativeReportParams({ ...params, page: undefined, limit: undefined }),
    responseType: 'blob',
  });
  return res.data;
}
