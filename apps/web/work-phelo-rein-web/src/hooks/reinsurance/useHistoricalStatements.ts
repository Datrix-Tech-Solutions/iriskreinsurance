import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';

const BASE = '/operations/reinsurance/historical-statements';

export const HISTORICAL_STATEMENTS_VIEW = 'operations.reinsurance.historical-statements:VIEW';
export const HISTORICAL_STATEMENTS_EXPORT = 'operations.reinsurance.historical-statements:EXPORT';

export type HistoricalStatementKind = 'INSURER' | 'REINSURER';

/** Source financial fields are decimal strings — never convert them to JS numbers. */
export type DecimalString = string | null;

export interface HistoricalDataset {
  id: string;
  datasetKey: string;
  datasetVersion: string;
  status: 'PUBLISHED';
  contractVersion: string;
  publishedAt: string | null;
  fileCount: number;
  insurerRowCount: number;
  reinsurerRowCount: number;
  linkCount: number;
}

export interface HistoricalMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface HistoricalQualityWarning {
  code: string;
  columnIndex?: number;
  sourceValue?: string;
}

interface HistoricalRowBase {
  id: string;
  datasetId: string;
  kind: HistoricalStatementKind;
  year: number;
  sourceFileName: string;
  sourceSheetName: string;
  sourceRow: number;
  rowSha256: string;
  qualityWarnings: HistoricalQualityWarning[];
  policyNumber: string | null;
  insuredName: string | null;
  businessName: string | null;
  offerDate: string | null;
  closedDate: string | null;
  startDate: string | null;
  endDate: string | null;
  currency: string | null;
  sumInsured100: DecimalString;
  premium100: DecimalString;
  facShare: DecimalString;
  facSumInsured: DecimalString;
  facPremium: DecimalString;
  paidFacPremium: DecimalString;
  paidCommission: DecimalString;
  brokerage: DecimalString;
  brokeragePaid: DecimalString;
  wht: DecimalString;
  nicLevy: DecimalString;
  paidNic: DecimalString;
  netPremiumDueReinsurer: DecimalString;
  netPremiumPaid: DecimalString;
  offerStatus: string | null;
  paymentStatus: string | null;
}

export interface HistoricalInsurerRow extends HistoricalRowBase {
  kind: 'INSURER';
  insurerName: string | null;
  insurerCommissionPercent: DecimalString;
  netPremiumDueBroker: DecimalString;
  netPremiumDueBrokerPaid: DecimalString;
  paidWht: DecimalString;
}

export interface HistoricalReinsurerRow extends HistoricalRowBase {
  kind: 'REINSURER';
  reinsurerName: string | null;
  reinsuredName: string | null;
  insurerCommissionAmount: DecimalString;
  paidWhtFirst: DecimalString;
  paidWhtSecond: DecimalString;
}

export type HistoricalStatementRow = HistoricalInsurerRow | HistoricalReinsurerRow;

export interface HistoricalOriginalColumn {
  columnIndex: number;
  columnLetter: string;
  header: string | null;
  sourceAddress: string | null;
  state: 'VALUE' | 'BLANK' | 'MISSING';
  cellType: string | null;
  value: string | null;
  xmlValue: string | null;
  styleIndex: number | null;
  formula: string | null;
  formulaAttributes: unknown;
  cachedValue: string | null;
}

export type HistoricalStatementDetail = HistoricalStatementRow & {
  dataset: HistoricalDataset;
  originalColumns: HistoricalOriginalColumn[];
};

export interface HistoricalLink {
  matchId: string;
  basis: 'SUPPLIED_AUTHORITATIVE' | 'APPROVED_CANDIDATE';
}

export interface HistoricalLinkedStatements {
  state: 'LINKED' | 'UNLINKED';
  /** CE→RE: linked reinsurer rows. RE→CE: zero or one linked insurer row. */
  items: { link: HistoricalLink; statement: HistoricalStatementRow }[];
  meta: HistoricalMeta | null;
}

export interface HistoricalFacets {
  years: number[];
  insurers: string[];
  reinsurers: string[];
  insureds: string[];
  businessNames: string[];
  currencies: string[];
  offerStatuses: string[];
  paymentStatuses: string[];
}

/** Common filters shared by list, facets and export. */
export interface HistoricalStatementFilters {
  datasetId: string;
  year?: number;
  policyNumber?: string;
  search?: string;
  insurer?: string;
  reinsurer?: string;
  insured?: string;
  businessName?: string;
  currency?: string;
  offerStatus?: string;
  paymentStatus?: string;
  offerDateFrom?: string;
  offerDateTo?: string;
  closedDateFrom?: string;
  closedDateTo?: string;
}

export interface HistoricalStatementListParams extends HistoricalStatementFilters {
  kind: HistoricalStatementKind;
  page?: number;
  limit?: number;
}

const kindPath = (kind: HistoricalStatementKind) =>
  kind === 'INSURER' ? 'insurers' : 'reinsurers';

/** Drops empty values — the API rejects unknown params and treats blanks as filters. */
function cleanParams<T extends object>(params: T): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Record<string, string | number>;
}

function filtersOf(params: HistoricalStatementFilters) {
  const { datasetId, ...rest } = params;
  return cleanParams({ datasetId, ...rest });
}

export function historicalErrorMessage(error: unknown): string | null {
  if (!error) return null;
  const err = error as { response?: { status?: number; data?: { message?: string | string[] } } };
  const status = err.response?.status;
  if (status === 403) {
    return 'Historical statements are not enabled for your account, or you do not have permission to view them.';
  }
  if (status === 404) return 'This dataset is no longer published. Refresh and pick another dataset.';
  if (status === 503) return 'Access could not be verified right now. Please try again shortly.';
  const message = err.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : (message ?? 'Failed to load historical statements.');
}

export function useHistoricalDatasets(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['reinsurance', 'historical-statements', 'datasets'],
    queryFn: async () => {
      const res = await api.get<{ items: HistoricalDataset[]; meta: HistoricalMeta }>(
        `${BASE}/datasets`,
        { params: { page: 1, limit: 200 } },
      );
      return res.data.items;
    },
    enabled: options.enabled ?? true,
    retry: false,
  });
}

export function useHistoricalStatements(
  params: HistoricalStatementListParams | null,
) {
  const result = useQuery({
    queryKey: ['reinsurance', 'historical-statements', 'list', params],
    queryFn: async () => {
      const { kind, page, limit, ...filters } = params as HistoricalStatementListParams;
      const res = await api.get<{
        dataset: HistoricalDataset;
        items: HistoricalStatementRow[];
        meta: HistoricalMeta;
      }>(`${BASE}/${kindPath(kind)}`, {
        params: { ...filtersOf(filters), page: page ?? 1, limit: limit ?? 50 },
      });
      return res.data;
    },
    enabled: params !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });

  return {
    rows: result.data?.items ?? [],
    meta: result.data?.meta ?? { page: 1, limit: params?.limit ?? 50, total: 0, totalPages: 0 },
    isLoading: result.isLoading,
    error: result.error,
  };
}

/** Unfiltered facets for a dataset — used to populate the filter choices. */
export function useHistoricalFacets(
  datasetId: string | undefined,
  kind: HistoricalStatementKind,
) {
  return useQuery({
    queryKey: ['reinsurance', 'historical-statements', 'facets', datasetId, kind],
    queryFn: async () => {
      const res = await api.get<HistoricalFacets>(`${BASE}/facets`, {
        params: { datasetId, kind },
      });
      return res.data;
    },
    enabled: Boolean(datasetId),
    retry: false,
  });
}

export function useHistoricalStatementDetail(
  kind: HistoricalStatementKind,
  id: string | null,
  datasetId: string,
) {
  return useQuery({
    queryKey: ['reinsurance', 'historical-statements', 'detail', kind, id, datasetId],
    queryFn: async () => {
      const res = await api.get<HistoricalStatementDetail>(`${BASE}/${kindPath(kind)}/${id}`, {
        params: { datasetId },
      });
      return res.data;
    },
    enabled: Boolean(id),
    retry: false,
  });
}

/** Approved links: CE→RE list, or RE→CE single row (normalised to the same list shape). */
export function useHistoricalLinks(
  kind: HistoricalStatementKind,
  id: string | null,
  datasetId: string,
) {
  return useQuery({
    queryKey: ['reinsurance', 'historical-statements', 'links', kind, id, datasetId],
    queryFn: async (): Promise<HistoricalLinkedStatements> => {
      if (kind === 'INSURER') {
        const res = await api.get<HistoricalLinkedStatements>(`${BASE}/insurers/${id}/reinsurers`, {
          params: { datasetId, page: 1, limit: 50 },
        });
        return res.data;
      }
      const res = await api.get<{
        state: 'LINKED' | 'UNLINKED';
        item: { link: HistoricalLink; statement: HistoricalStatementRow } | null;
      }>(`${BASE}/reinsurers/${id}/insurer`, { params: { datasetId } });
      return {
        state: res.data.state,
        items: res.data.item ? [res.data.item] : [],
        meta: null,
      };
    },
    enabled: Boolean(id),
    retry: false,
  });
}

export async function downloadHistoricalStatementsExcel(
  kind: HistoricalStatementKind,
  filters: HistoricalStatementFilters,
): Promise<Blob> {
  const res = await api.get<Blob>(`${BASE}/${kindPath(kind)}/export.xlsx`, {
    params: filtersOf(filters),
    responseType: 'blob',
  });
  return res.data;
}
