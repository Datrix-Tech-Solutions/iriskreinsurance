import { reinsuranceReportsKey, reportFilterCsv } from '@/lib/reinsurance/reportCache';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ClaimState } from '@/types/reinsurance';

const CLAIMS_REPORT_BASE = '/operations/reinsurance/reports/claims';

export type ClaimsReportBucket = 'notification' | 'open' | 'closed';
export type ClaimsReportScope = 'general' | 'cedant' | 'reinsurer';
export type ClaimsReportRecoveryStatus = 'outstanding' | 'part' | 'full';

export interface ClaimsReportParams {
  /** Restricts to claims whose occurrenceDate falls in [startDate, endDate]. */
  startDate?: string;
  endDate?: string;
  cedantIds?: string[];
  reinsurerIds?: string[];
  currencies?: string[];
  buckets?: ClaimsReportBucket[];
  stages?: Array<'pending' | 'finalized'>;
  recoveryStatuses?: ClaimsReportRecoveryStatus[];
  scope?: ClaimsReportScope;
  page?: number;
  limit?: number;
  sortBy?:
    | 'occurrenceDate'
    | 'claimNumber'
    | 'policyNumber'
    | 'cedantName'
    | 'claimAmount'
    | 'iriskShareAmount'
    | 'iriskShareOutstanding'
    | 'reinsurerName'
    | 'reinsurerShareAmount'
    | 'reinsurerOutstandingAmount'
    | 'agingDays';
  sortOrder?: 'asc' | 'desc';
}

export interface ClaimReportRow {
  id: string;
  claimId: string;
  placementId: string;
  bucket: ClaimsReportBucket;
  policyNumber: string;
  businessName: string;
  cedantId: string;
  cedantName: string;
  riskTypeId: string | null;
  policyType: string | null;
  claimType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  claimNumber: string;
  currency: string;
  occurrenceDate: string;
  premiumPaidAt: string | null;
  estimatedLossAmount: number;
  finalLossAmount: number | null;
  claimAmount: number;
  claimState: ClaimState;
  finalizedAt: string | null;
  recoveredAmount: number | null;
  recoveredAt: string | null;
  iriskSharePercent: number | null;
  iriskShareAmount: number | null;
  iriskSharePaid: number | null;
  iriskShareOutstanding: number | null;
  reinsurerId: string | null;
  reinsurerName: string | null;
  reinsurerSharePercent: number | null;
  reinsurerShareAmount: number | null;
  reinsurerPaidAmount: number | null;
  reinsurerOutstandingAmount: number | null;
  agingDays: number | null;
  dolDop: number | null;
}

export interface ClaimsReportCurrencyTotals {
  currency: string;
  claimCount: number;
  claimAmount: number;
  iriskShareAmount: number;
  bankConfirmedRecovery: number;
  outstandingRecovery: number;
  reinsurerShareAmount: number;
  reinsurerPaidAmount: number;
  reinsurerOutstandingAmount: number;
}

export interface ClaimsReportSummary {
  scope: ClaimsReportScope;
  openClaims: number;
  closedClaims: number;
  recoveryRate: number;
  claimCount: number;
  cedantCount: number;
  reinsurerCount: number;
  notificationCount: number;
  openCount: number;
  closedCount: number;
  pendingCount: number;
  finalizedCount: number;
  recoveryCounts: { outstanding: number; part: number; full: number };
  totalsByCurrency: ClaimsReportCurrencyTotals[];
}

export interface ClaimsReportMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ClaimsReportResponse {
  items: ClaimReportRow[];
  summary: ClaimsReportSummary;
  meta: ClaimsReportMeta;
}

function claimStatesFromStages(stages?: Array<'pending' | 'finalized'>): ClaimState[] | undefined {
  if (!stages?.length) return undefined;
  const states: ClaimState[] = [];
  if (stages.includes('pending')) states.push('PENDING');
  if (stages.includes('finalized')) states.push('FINALIZED');
  return states;
}

function normalizeReportParams(params: ClaimsReportParams = {}) {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    scope: params.scope ?? 'general',
    ...(params.startDate ? { dateFrom: params.startDate } : {}),
    ...(params.endDate ? { dateTo: params.endDate } : {}),
    ...(params.currencies?.length ? { currency: reportFilterCsv(params.currencies) } : {}),
    ...(params.buckets?.length ? { bucket: reportFilterCsv(params.buckets) } : {}),
    ...(claimStatesFromStages(params.stages)?.length
      ? { claimState: claimStatesFromStages(params.stages)?.join(',') }
      : {}),
    ...(params.recoveryStatuses?.length
      ? { recoveryStatus: reportFilterCsv(params.recoveryStatuses) }
      : {}),
    ...(params.cedantIds?.length ? { cedantId: reportFilterCsv(params.cedantIds) } : {}),
    ...(params.reinsurerIds?.length ? { reinsurerId: reportFilterCsv(params.reinsurerIds) } : {}),
    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
  };
}

export const claimsReportKey = (params: ClaimsReportParams = {}) =>
  [...reinsuranceReportsKey, 'claims', normalizeReportParams(params)] as const;

const emptySummary: ClaimsReportSummary = {
  scope: 'general',
  openClaims: 0,
  closedClaims: 0,
  recoveryRate: 0,
  claimCount: 0,
  cedantCount: 0,
  reinsurerCount: 0,
  notificationCount: 0,
  openCount: 0,
  closedCount: 0,
  pendingCount: 0,
  finalizedCount: 0,
  recoveryCounts: { outstanding: 0, part: 0, full: 0 },
  totalsByCurrency: [],
};

export function useClaimsReport(
  params: ClaimsReportParams,
  options: { enabled?: boolean } = {},
): Pick<UseQueryResult<ClaimsReportResponse>, 'isError' | 'error' | 'refetch'> & {
  rows: ClaimReportRow[];
  summary: ClaimsReportSummary;
  meta: ClaimsReportMeta;
  isLoading: boolean;
} {
  const normalizedParams = normalizeReportParams(params);
  const result = useQuery({
    queryKey: claimsReportKey(params),
    queryFn: async ({ signal }) => {
      const res = await api.get<ClaimsReportResponse>(CLAIMS_REPORT_BASE, {
        signal,
        params: normalizedParams,
      });
      return res.data;
    },
    enabled: options.enabled ?? true,
  });

  return {
    rows: result.data?.items ?? [],
    summary: result.data?.summary ?? {
      ...emptySummary,
      scope: params.scope ?? 'general',
    },
    meta: result.data?.meta ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      total: 0,
      totalPages: 0,
    },
    isLoading: result.isFetching,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

export async function downloadClaimsReportCsv(params: ClaimsReportParams): Promise<string> {
  const res = await api.get<string>(`${CLAIMS_REPORT_BASE}/export.csv`, {
    params: normalizeReportParams(params),
    responseType: 'text',
  });
  return res.data;
}

export async function downloadClaimsReportExcel(params: ClaimsReportParams): Promise<Blob> {
  const res = await api.get<Blob>(`${CLAIMS_REPORT_BASE}/export.xls`, {
    params: normalizeReportParams(params),
    responseType: 'blob',
  });
  return res.data;
}
