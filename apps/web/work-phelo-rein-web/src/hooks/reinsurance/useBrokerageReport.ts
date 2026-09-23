import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PremiumReportDateBasis, PremiumsReportParams } from './usePremiumsReport';
import { CedantPaymentStatus } from '@/lib/reinsurance/placementStatus';

const BROKERAGE_REPORT_BASE = '/operations/reinsurance/reports/brokerage';

export type BrokerageReportScope = 'cedant' | 'reinsurer';

export type BrokerageReportParams = PremiumsReportParams & {
  scope?: BrokerageReportScope;
  reinsurerIds?: string[];
};

export interface BrokerageReportRow {
  id: string;
  placementId: string;
  policyNumber: string | null;
  title: string;
  cedantId: string;
  cedantName: string;
  reinsurerId: string | null;
  reinsurerName: string | null;
  riskTypeId: string | null;
  policyType: string | null;
  status: string;
  inceptionDate: string | null;
  expiryDate: string | null;
  currency: string | null;
  sumInsured: number | null;
  premium: number | null;
  exchangeRate: number | null;
  grossPremium: number | null;
  brokerageAmount: number | null;
  brokeragePaid: number | null;
  withholdingTax: number | null;
  withholdingTaxPaid: number | null;
  nicLevy: number | null;
  nicLevyPaid: number | null;
  paymentStatus: CedantPaymentStatus;
}

export interface BrokerageReportCurrencyTotals {
  currency: string;
  placementCount: number;
  participantCount: number;
  premium: number;
  grossPremium: number;
  brokerageAmount: number;
  brokeragePaid: number;
  withholdingTax: number;
  withholdingTaxPaid: number;
  nicLevy: number;
  nicLevyPaid: number;
}

export interface BrokerageReportSummary {
  scope: BrokerageReportScope;
  placementCount: number;
  participantCount: number;
  totalsByCurrency: BrokerageReportCurrencyTotals[];
}

export interface BrokerageReportMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BrokerageReportResponse {
  items: BrokerageReportRow[];
  summary: BrokerageReportSummary;
  meta: BrokerageReportMeta;
}

function normalizeReportParams(params: BrokerageReportParams = {}) {
  const placementStatus =
    params.offerStatus === 'closed'
      ? ['CLOSED']
      : params.offerStatus === 'open'
        ? ['DRAFT', 'PLACED', 'PARTIALLY_PLACED', 'CLOSING']
        : undefined;

  return {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    dateBasis: (params.dateBasis ?? 'INCEPTION_DATE') as PremiumReportDateBasis,
    scope: params.scope ?? 'reinsurer',
    ...(params.startDate ? { dateFrom: params.startDate } : {}),
    ...(params.endDate ? { dateTo: params.endDate } : {}),
    ...(params.riskTypeIds?.length ? { riskTypeId: params.riskTypeIds.join(',') } : {}),
    ...(params.currencies?.length ? { currency: params.currencies.join(',') } : {}),
    ...(params.paymentStatuses?.length ? { paymentStatus: params.paymentStatuses.join(',') } : {}),
    ...(params.cedantIds?.length ? { cedantId: params.cedantIds.join(',') } : {}),
    ...(params.reinsurerIds?.length ? { reinsurerId: params.reinsurerIds.join(',') } : {}),
    ...(placementStatus ? { placementStatus: placementStatus.join(',') } : {}),
    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
    ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
  };
}

export const brokerageReportKey = (params: BrokerageReportParams = {}) =>
  ['reinsurance', 'reports', 'brokerage', normalizeReportParams(params)] as const;

const emptySummary: BrokerageReportSummary = {
  scope: 'reinsurer',
  placementCount: 0,
  participantCount: 0,
  totalsByCurrency: [],
};

export function useBrokerageReport(
  params: BrokerageReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: BrokerageReportRow[];
  summary: BrokerageReportSummary;
  meta: BrokerageReportMeta;
  isLoading: boolean;
} {
  const normalizedParams = normalizeReportParams(params);
  const result = useQuery({
    queryKey: brokerageReportKey(params),
    queryFn: async () => {
      const res = await api.get<BrokerageReportResponse>(BROKERAGE_REPORT_BASE, {
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
      scope: params.scope ?? 'reinsurer',
    },
    meta: result.data?.meta ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      total: 0,
      totalPages: 0,
    },
    isLoading: result.isLoading,
  };
}

export async function downloadBrokerageReportCsv(params: BrokerageReportParams): Promise<string> {
  const res = await api.get<string>(`${BROKERAGE_REPORT_BASE}/export.csv`, {
    params: normalizeReportParams(params),
    responseType: 'text',
  });
  return res.data;
}
