import { createHash } from 'node:crypto';

export type Kind = 'INSURER' | 'REINSURER';
export const CONTRACT = 'historical-statements/2021-2025/v1';
export const SHEET = 'Brokerage Statement';
export const EXPECTED_ROWS: Record<number, [number, number]> = {
  2021: [435, 1236],
  2022: [610, 1742],
  2023: [897, 2557],
  2024: [1104, 2976],
  2025: [1312, 3652],
};
export const CE_HEADERS = [
  'Policy #',
  'Insurer',
  'Insured',
  'Business Name',
  'Offer Date',
  'Date Closed',
  'Start Date',
  'End Date',
  'Currency',
  '100% Sum Insured',
  '100% Premium',
  'Fac. Share',
  'Fac. Sum Insured',
  'Fac. Premium',
  'Paid fac premium',
  "Insurer's Commission (%)",
  'Paid Commission',
  'Net Premium due Broker',
  'Net Premium due Broker Paid',
  'Brokerage',
  'Brokerage Paid',
  'WHT',
  'Paid WHT',
  'NIC Levy',
  'Paid NIC',
  'Net Premium Due Reinsurer',
  'Net Premium Paid',
  'Offer Status',
  'Payment Status',
];
export const RE_HEADERS = [
  'Policy #',
  'Reinsurer',
  'Insured',
  'Business Name',
  'Reinsured',
  'Offer Date',
  'Date Closed',
  'Start Date',
  'End Date',
  'Currency',
  '100% Sum Insured',
  '100% Premium',
  'Fac. Share',
  'Fac. Sum Insured',
  'Fac. Premium',
  'Paid fac premium',
  'Insurer Commission',
  'Paid Commission',
  'Brokerage',
  'Brokerage Paid',
  'WHT',
  'Paid WHT',
  'Paid WHT',
  'NIC Levy',
  'Paid NIC',
  'Net Premium Due Reinsurer',
  'Net Premium Paid',
  'Offer Status',
  'Payment Status',
];
export const CE_FIELDS = [
  'policyNumber',
  'insurerName',
  'insuredName',
  'businessName',
  'offerDate',
  'closedDate',
  'startDate',
  'endDate',
  'currency',
  'sumInsured100',
  'premium100',
  'facShare',
  'facSumInsured',
  'facPremium',
  'paidFacPremium',
  'insurerCommissionPercent',
  'paidCommission',
  'netPremiumDueBroker',
  'netPremiumDueBrokerPaid',
  'brokerage',
  'brokeragePaid',
  'wht',
  'paidWht',
  'nicLevy',
  'paidNic',
  'netPremiumDueReinsurer',
  'netPremiumPaid',
  'offerStatus',
  'paymentStatus',
];
export const RE_FIELDS = [
  'policyNumber',
  'reinsurerName',
  'insuredName',
  'businessName',
  'reinsuredName',
  'offerDate',
  'closedDate',
  'startDate',
  'endDate',
  'currency',
  'sumInsured100',
  'premium100',
  'facShare',
  'facSumInsured',
  'facPremium',
  'paidFacPremium',
  'insurerCommissionAmount',
  'paidCommission',
  'brokerage',
  'brokeragePaid',
  'wht',
  'paidWhtFirst',
  'paidWhtSecond',
  'nicLevy',
  'paidNic',
  'netPremiumDueReinsurer',
  'netPremiumPaid',
  'offerStatus',
  'paymentStatus',
];
export const DATE_FIELDS = new Set([
  'offerDate',
  'closedDate',
  'startDate',
  'endDate',
]);
export interface RawCell {
  columnIndex: number;
  columnLetter: string;
  sourceAddress: string;
  state: 'VALUE' | 'BLANK' | 'MISSING';
  type:
    | 'SHARED_STRING'
    | 'INLINE_STRING'
    | 'NUMBER'
    | 'BOOLEAN'
    | 'ERROR'
    | 'FORMULA'
    | null;
  xmlValue: string | null;
  resolvedText: string | null;
  styleIndex: number | null;
  formula: string | null;
  formulaAttributes: Record<string, string> | null;
  cachedValue: string | null;
}
export interface QualityFlag {
  code: string;
  columnIndex?: number;
  sourceValue?: string;
}
export interface SourceRow {
  sourceRow: number;
  rowSha256: string;
  rawCells: RawCell[];
  fields: Record<string, string | null>;
  qualityFlags: QualityFlag[];
}
export interface SourceFileInput {
  path: string;
  kind: Kind;
  year: number;
  sha256: string;
  rawStorageProvider?: string;
  rawStorageKey?: string;
}
export interface WorkbookData {
  input: SourceFileInput;
  fileName: string;
  byteSize: number;
  sha256: string;
  sheetName: string;
  sheetXmlPath: string;
  headerSha256: string;
  headerCells: RawCell[];
  workbookMetadata: Record<string, unknown>;
  physicalRowCount: number;
  rows: SourceRow[];
}
export interface SourceManifest {
  contractVersion: typeof CONTRACT;
  datasetKey: string;
  datasetVersion: string;
  tenantId?: string;
  allUnlinked: boolean;
  files: SourceFileInput[];
  matchManifestSha256?: string;
}
export interface ApprovedLink {
  matchId: string;
  insurer: RowRef;
  reinsurers: RowRef[];
  basis: 'SUPPLIED_AUTHORITATIVE' | 'APPROVED_CANDIDATE';
  approvalRef: string;
  approvedByUserId: string;
  approvedAt: string;
  evidence: Record<string, unknown>;
}
export interface RowRef {
  fileSha256: string;
  sheet: string;
  sourceRow: number;
  rowSha256: string;
}
export interface MatchManifest {
  contractVersion: 'historical-statement-links/v1';
  tenantId: string;
  datasetKey: string;
  datasetVersion: string;
  groups: ApprovedLink[];
  unapprovedCandidates?: unknown[];
}
export interface ValidatedDataset {
  manifest: SourceManifest;
  files: WorkbookData[];
  links: ApprovedLink[];
  contentManifestSha256: string;
  matchManifestSha256: string | null;
  observations: Record<string, number>;
  discrepancies: string[];
}
export function canonical(value: unknown): string {
  if (
    value === undefined ||
    (typeof value === 'number' && !Number.isFinite(value))
  )
    throw new Error('Non-JSON canonical value');
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`)
    .join(',')}}`;
}
export function sha(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function bytesSha(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
export function column(index: number): string {
  return index <= 26
    ? String.fromCharCode(64 + index)
    : `A${String.fromCharCode(38 + index)}`;
}
export function object(
  value: unknown,
  label = 'object',
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096)
    throw new Error(`Invalid ${label}`);
  return value;
}
export function hashText(value: unknown, label: string): string {
  const s = text(value, label);
  if (!/^[0-9a-f]{64}$/.test(s)) throw new Error(`Invalid ${label}`);
  return s;
}
