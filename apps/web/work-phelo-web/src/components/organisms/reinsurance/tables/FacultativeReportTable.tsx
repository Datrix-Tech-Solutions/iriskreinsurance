'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { ReportCurrencySummaryCards } from '@/components/molecules/reinsurance/reports/ReportCurrencySummaryCards';
import {
  useCedantOptions,
  useReinsurerOptions,
  useRiskClassOptions,
  useCurrencyOptions,
  useFacultativeReport,
} from '@/hooks';
import {
  FacultativeReportRow,
  FacultativeReinsurerBreakdown,
  FacultativeReportParams,
  FacultativeReportDateField,
  FacultativeReportLifecycle,
} from '@/hooks/reinsurance/useFacultativeReport';
import { FACULTATIVE_STATUSES, FacultativeStatus } from '@/types/reinsurance';
import { facultativeStatusLabel, CedantPaymentStatus } from '@/lib/reinsurance/placementStatus';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { exportToCsv } from '@/lib/exportCsv';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = FACULTATIVE_STATUSES.map((s) => ({
  value: s,
  label: facultativeStatusLabel(s),
}));

const DATE_FIELD_OPTIONS: { value: FacultativeReportDateField; label: string }[] = [
  { value: 'createdAt', label: 'Date of entry' },
  { value: 'premiumPaid', label: 'Premium paid' },
  { value: 'closingDate', label: 'Closing date' },
];

const LIFECYCLE_OPTIONS: { value: FacultativeReportLifecycle; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
];

const PAYMENT_STATUS_OPTIONS: { value: CedantPaymentStatus; label: string }[] = [
  { value: 'Outstanding', label: 'Outstanding' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Part Payment', label: 'Part Payment' },
  { value: 'Paid', label: 'Paid' },
];

// Same scope filter as the Premiums report — a placement viewed from either the
// cedant side (one row) or the reinsurer side (one row per accepted reinsurer).
type FacultativeReportScope = 'cedant' | 'reinsurer';

const SCOPE_OPTIONS: { value: FacultativeReportScope; label: string }[] = [
  { value: 'cedant', label: 'Cedants' },
  { value: 'reinsurer', label: 'Reinsurer' },
];

const STATUS_VARIANT_MAP: Record<FacultativeStatus, 'success' | 'warning' | 'neutral' | 'danger'> =
  {
    DRAFT: 'neutral',
    MARKETING: 'warning',
    PARTIALLY_PLACED: 'success',
    PLACED: 'success',
    CLOSING: 'warning',
    CLOSED: 'success',
    DECLINED: 'danger',
    CANCELLED: 'danger',
  };

const PAYMENT_STATUS_VARIANT_MAP: Record<CedantPaymentStatus, 'success' | 'warning' | 'neutral'> = {
  Outstanding: 'neutral',
  Pending: 'warning',
  'Part Payment': 'warning',
  Paid: 'success',
};

function fmtAmount(value: number | null, currency: string | null): string {
  if (value == null) return '—';
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-gray-400">{children}</span>
);

/* ── display row ──
 * One row per report row under Cedants scope; one row per accepted reinsurer
 * (shared placement cells repeated) under Reinsurer scope. */
interface FacultativeReportDisplayRow extends FacultativeReportRow {
  rowId: string;
  reinsurerId: string | null;
  reinsurerName: string | null;
  /** That reinsurer's share % under Reinsurer scope, else the placement's accepted %. */
  scopeSharePercent: number;
}

function flattenRow(
  r: FacultativeReportRow,
  reinsurer: FacultativeReinsurerBreakdown | null,
): FacultativeReportDisplayRow {
  return {
    ...r,
    rowId: reinsurer ? `${r.id}:${reinsurer.reinsurerId}` : r.id,
    reinsurerId: reinsurer?.reinsurerId ?? null,
    reinsurerName: reinsurer?.reinsurerName ?? null,
    scopeSharePercent: reinsurer ? (reinsurer.sharePercent ?? 0) : r.totalAcceptedPercent,
  };
}

/* ── columns ──
 * `csv` regenerates the export for whichever scope is active; DataTable ignores it. */
type ReportColumn = Column<FacultativeReportDisplayRow> & {
  csv?: (row: FacultativeReportDisplayRow) => string | number;
};

const POLICY_NUMBER_COLUMN: ReportColumn = {
  key: 'reference',
  label: 'Policy Number',
  width: '120px',
  render: (row) => (
    <EndorsedReferencePill id={row.id} reference={displayPolicyNumber(row.policyNumber)} />
  ),
  csv: (row) => displayPolicyNumber(row.policyNumber),
};

const REINSURER_NAME_COLUMN: ReportColumn = {
  key: 'reinsurerName',
  label: 'Reinsurer',
  width: 'minmax(120px, 0.8fr)',
  render: (row) =>
    row.reinsurerName ? (
      <span className="text-gray-700">{row.reinsurerName}</span>
    ) : (
      <Muted>—</Muted>
    ),
  csv: (row) => row.reinsurerName ?? '',
};

const CEDANT_COLUMN: ReportColumn = {
  key: 'cedantName',
  label: 'Cedant',
  width: 'minmax(120px, 0.8fr)',
  render: (row) => <span className="font-semibold text-gray-900">{row.cedantName}</span>,
  csv: (row) => row.cedantName,
};

const MIDDLE_COLUMNS: ReportColumn[] = [
  {
    key: 'riskClassName',
    label: 'Risk Class',
    width: '90px',
    render: (row) => row.riskClassName ?? '—',
    csv: (row) => row.riskClassName ?? '',
  },
  {
    key: 'sumInsured',
    label: 'Sum Insured',
    width: '120px',
    className: 'text-right',
    render: (row) => fmtAmount(row.sumInsured, row.currency),
    csv: (row) => row.sumInsured ?? '',
  },
  {
    key: 'premium',
    label: 'Premium',
    width: '120px',
    className: 'text-right',
    render: (row) => fmtAmount(row.premium, row.currency),
    csv: (row) => row.premium ?? '',
  },
  {
    key: 'commission',
    label: 'Commission',
    width: '70px',
    render: (row) => (row.commission != null ? `${row.commission}%` : '—'),
    csv: (row) => (row.commission != null ? `${row.commission}%` : ''),
  },
];

// Cedant scope keeps the placement-level acceptance figures.
const CEDANT_SHARE_COLUMNS: ReportColumn[] = [
  {
    key: 'totalAcceptedPercent',
    label: 'Accepted',
    width: '70px',
    render: (row) => `${row.totalAcceptedPercent}%`,
    csv: (row) => `${row.totalAcceptedPercent}%`,
  },
  {
    key: 'reinsurerCount',
    label: 'Reinsurers',
    width: '70px',
    render: (row) => row.reinsurerCount.toLocaleString(),
    csv: (row) => row.reinsurerCount,
  },
];

// Reinsurer scope swaps those for that single reinsurer's share.
const REINSURER_SHARE_COLUMN: ReportColumn = {
  key: 'scopeSharePercent',
  label: 'Share',
  width: '70px',
  render: (row) => (row.reinsurerId ? `${row.scopeSharePercent}%` : '—'),
  csv: (row) => (row.reinsurerId ? `${row.scopeSharePercent}%` : ''),
};

const TAIL_COLUMNS: ReportColumn[] = [
  {
    key: 'inceptionDate',
    label: 'Inception',
    width: '90px',
    render: (row) => fmtDate(row.inceptionDate),
    csv: (row) => fmtDate(row.inceptionDate),
  },
  {
    key: 'expiryDate',
    label: 'Expiry',
    width: '90px',
    render: (row) => fmtDate(row.expiryDate),
    csv: (row) => fmtDate(row.expiryDate),
  },
  {
    key: 'paymentStatus',
    label: 'Payment Status',
    width: '110px',
    render: (row) => (
      <Badge label={row.paymentStatus} variant={PAYMENT_STATUS_VARIANT_MAP[row.paymentStatus]} />
    ),
    csv: (row) => row.paymentStatus,
  },
  {
    key: 'status',
    label: 'Status',
    width: '90px',
    render: (row) => (
      <Badge label={facultativeStatusLabel(row.status)} variant={STATUS_VARIANT_MAP[row.status]} />
    ),
    csv: (row) => facultativeStatusLabel(row.status),
  },
];

const COLUMNS_BY_SCOPE: Record<FacultativeReportScope, ReportColumn[]> = {
  cedant: [
    POLICY_NUMBER_COLUMN,
    CEDANT_COLUMN,
    ...MIDDLE_COLUMNS,
    ...CEDANT_SHARE_COLUMNS,
    ...TAIL_COLUMNS,
  ],
  reinsurer: [
    POLICY_NUMBER_COLUMN,
    REINSURER_NAME_COLUMN,
    CEDANT_COLUMN,
    ...MIDDLE_COLUMNS,
    REINSURER_SHARE_COLUMN,
    ...TAIL_COLUMNS,
  ],
};

export function FacultativeReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [page, setPage] = useState(1);

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [dateField, setDateField] = useState<FacultativeReportDateField>('createdAt');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [riskClassIds, setRiskClassIds] = useState<string[]>([]);
  const [currency, setCurrency] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [lifecycle, setLifecycle] = useState('');
  const [paymentStatuses, setPaymentStatuses] = useState<string[]>([]);
  const [scope, setScope] = useState<FacultativeReportScope>('cedant');
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reinsurerIds, setReinsurerIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<FacultativeReportParams | null>(null);

  const { options: cedantOptions } = useCedantOptions();
  const { options: reinsurerOptions } = useReinsurerOptions();
  const { data: riskClassOptions = [] } = useRiskClassOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const handleScopeChange = (value: string) => {
    setScope(value as FacultativeReportScope);
    setCedantIds([]);
    setReinsurerIds([]);
    setPage(1);
  };

  const { rows, currencyTotals, isLoading } = useFacultativeReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    setReportParams({
      dateField,
      startDate,
      endDate,
      riskClassIds: riskClassIds.length ? riskClassIds : undefined,
      currency: currency || undefined,
      statuses: statuses.length ? (statuses as FacultativeStatus[]) : undefined,
      cedantIds: scope === 'cedant' && cedantIds.length ? cedantIds : undefined,
      lifecycle: (lifecycle || undefined) as FacultativeReportLifecycle | undefined,
      paymentStatuses: paymentStatuses.length
        ? (paymentStatuses as CedantPaymentStatus[])
        : undefined,
    });
    setPage(1);
  };

  const columns = useMemo<ReportColumn[]>(() => COLUMNS_BY_SCOPE[scope], [scope]);

  // Cedants scope: one row per placement. Reinsurer scope: explode per accepted
  // reinsurer, then narrow to the selected reinsurers.
  const displayRows = useMemo<FacultativeReportDisplayRow[]>(() => {
    if (scope === 'cedant') return rows.map((r) => flattenRow(r, null));

    const flat = rows.flatMap((r) =>
      r.reinsurers.length ? r.reinsurers.map((re) => flattenRow(r, re)) : [flattenRow(r, null)],
    );
    if (reinsurerIds.length) {
      const selected = new Set(reinsurerIds);
      return flat.filter((row) => row.reinsurerId != null && selected.has(row.reinsurerId));
    }
    return flat;
  }, [rows, scope, reinsurerIds]);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const paged = displayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    const headers = columns.map((c) => c.label);
    const data = displayRows.map((row) => columns.map((c) => c.csv?.(row) ?? ''));
    exportToCsv(`facultative-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {reportParams && <ReportCurrencySummaryCards totals={currencyTotals} isLoading={isLoading} />}

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={paged}
          isLoading={reportParams !== null && isLoading}
          onRowClick={(row) =>
            router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.id}`)
          }
          onExport={reportParams && displayRows.length > 0 ? handleExport : undefined}
          extraFilters={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-40">
                <SearchSelect
                  size="sm"
                  placeholder="Date field"
                  options={DATE_FIELD_OPTIONS}
                  value={dateField}
                  onChange={(v) => setDateField(v as FacultativeReportDateField)}
                />
              </div>
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder="Start date"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder="End date"
                  value={endDate}
                  minDate={startDate || undefined}
                  onChange={setEndDate}
                />
              </div>
              <div className="w-36">
                <MultiSelect
                  size="sm"
                  variant="inline"
                  placeholder="Risk class"
                  options={riskClassOptions}
                  value={riskClassIds}
                  onChange={setRiskClassIds}
                />
              </div>
              <div className="w-32">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Currency"
                  options={currencyOptions}
                  value={currency}
                  onChange={setCurrency}
                />
              </div>
              <div className="w-32">
                <MultiSelect
                  size="sm"
                  variant="inline"
                  placeholder="Status"
                  options={STATUS_OPTIONS}
                  value={statuses}
                  onChange={setStatuses}
                />
              </div>
              <div className="w-32">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Active/Expired"
                  options={LIFECYCLE_OPTIONS}
                  value={lifecycle}
                  onChange={setLifecycle}
                />
              </div>
              <div className="w-40">
                <MultiSelect
                  size="sm"
                  variant="inline"
                  placeholder="Payment status"
                  options={PAYMENT_STATUS_OPTIONS}
                  value={paymentStatuses}
                  onChange={setPaymentStatuses}
                />
              </div>
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  placeholder="Scope"
                  options={SCOPE_OPTIONS}
                  value={scope}
                  onChange={handleScopeChange}
                />
              </div>
              {scope === 'cedant' && (
                <div className="w-44">
                  <MultiSelect
                    size="sm"
                    variant="inline"
                    placeholder="Cedants"
                    options={cedantOptions}
                    value={cedantIds}
                    onChange={setCedantIds}
                  />
                </div>
              )}
              {scope === 'reinsurer' && (
                <div className="w-44">
                  <MultiSelect
                    size="sm"
                    variant="inline"
                    placeholder="Reinsurers"
                    options={reinsurerOptions}
                    value={reinsurerIds}
                    onChange={(next) => {
                      setReinsurerIds(next);
                      setPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          }
          actionButton={{
            label: 'Run Filter',
            onClick: handleRunFilter,
            disabled: !startDate || !endDate,
          }}
          emptyMessage={
            reportParams
              ? 'No facultative activity for the selected filters'
              : 'Select a date field, date range, and click Run Filter to generate the report'
          }
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>
    </div>
  );
}
