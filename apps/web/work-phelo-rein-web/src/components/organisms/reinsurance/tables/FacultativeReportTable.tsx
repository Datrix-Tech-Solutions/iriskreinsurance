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
import {
  useCedantOptions,
  useReinsurerOptions,
  useRiskClassOptions,
  useCurrencyOptions,
  useFacultativeReport,
  useReportPagination,
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
import { todayISODate } from '@/lib/reinsurance/reportDates';
import { exportToCsv } from '@/lib/exportCsv';

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
  /** The reinsurer this row was exploded for (Reinsurer scope); null under Cedants scope. */
  scopeReinsurer: FacultativeReinsurerBreakdown | null;
}

function flattenRow(
  r: FacultativeReportRow,
  reinsurer: FacultativeReinsurerBreakdown | null,
): FacultativeReportDisplayRow {
  return {
    ...r,
    rowId: reinsurer ? `${r.id}:${reinsurer.reinsurerId}` : r.id,
    scopeReinsurer: reinsurer,
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

const BUSINESS_NAME_COLUMN: ReportColumn = {
  key: 'business',
  label: 'Business Name',
  width: '110px',
  render: (row) => row.riskClassName ?? '—',
  csv: (row) => row.riskClassName ?? '',
};

const INSURED_COLUMN: ReportColumn = {
  key: 'insured',
  label: 'Insured',
  width: 'minmax(120px, 0.8fr)',
  render: (row) =>
    row.title ? <span className="text-gray-700">{row.title}</span> : <Muted>—</Muted>,
  csv: (row) => row.title,
};

const dateCol = (
  key: string,
  label: string,
  pick: (row: FacultativeReportDisplayRow) => string | null,
): ReportColumn => ({
  key,
  label,
  width: '95px',
  render: (row) => fmtDate(pick(row)),
  csv: (row) => fmtDate(pick(row)),
});

const CURRENCY_COLUMN: ReportColumn = {
  key: 'currency',
  label: 'Currency',
  width: '70px',
  render: (row) => row.currency ?? '—',
  csv: (row) => row.currency ?? '',
};

const OFFER_STATUS_COLUMN: ReportColumn = {
  key: 'offerStatus',
  label: 'Offer Status',
  width: '100px',
  render: (row) => (
    <Badge label={facultativeStatusLabel(row.status)} variant={STATUS_VARIANT_MAP[row.status]} />
  ),
  csv: (row) => facultativeStatusLabel(row.status),
};

const PAYMENT_STATUS_COLUMN: ReportColumn = {
  key: 'paymentStatus',
  label: 'Payment Status',
  width: '120px',
  render: (row) => (
    <Badge label={row.paymentStatus} variant={PAYMENT_STATUS_VARIANT_MAP[row.paymentStatus]} />
  ),
  csv: (row) => row.paymentStatus,
};

const fac = (row: FacultativeReportDisplayRow) => row.cedantFinancials;

const rightAmount = (
  key: string,
  label: string,
  pick: (row: FacultativeReportDisplayRow) => number | null,
  width = '140px',
): ReportColumn => ({
  key,
  label,
  width,
  className: 'text-right',
  render: (row) => fmtAmount(pick(row), row.currency),
  csv: (row) => pick(row) ?? '',
});

// Full financial breakdown of each placement from the cedant's side — one row per offer.
const CEDANT_SCOPE_COLUMNS: ReportColumn[] = [
  POLICY_NUMBER_COLUMN,
  {
    key: 'insurer',
    label: 'Insurer',
    width: 'minmax(120px, 0.8fr)',
    render: (row) => <span className="font-semibold text-gray-900">{row.cedantName}</span>,
    csv: (row) => row.cedantName,
  },
  {
    key: 'insured',
    label: 'Insured',
    width: 'minmax(120px, 0.8fr)',
    render: (row) => (row.title ? <span className="text-gray-700">{row.title}</span> : <Muted>—</Muted>),
    csv: (row) => row.title,
  },
  {
    key: 'business',
    label: 'Risk Type',
    width: '110px',
    render: (row) => row.riskClassName ?? '—',
    csv: (row) => row.riskClassName ?? '',
  },
  {
    key: 'offerDate',
    label: 'Offer Date',
    width: '95px',
    render: (row) => fmtDate(row.offerDate),
    csv: (row) => fmtDate(row.offerDate),
  },
  {
    key: 'closedAt',
    label: 'Date Closed',
    width: '95px',
    render: (row) => fmtDate(row.closedAt),
    csv: (row) => fmtDate(row.closedAt),
  },
  {
    key: 'startDate',
    label: 'Start Date',
    width: '95px',
    render: (row) => fmtDate(row.inceptionDate),
    csv: (row) => fmtDate(row.inceptionDate),
  },
  {
    key: 'endDate',
    label: 'End Date',
    width: '95px',
    render: (row) => fmtDate(row.expiryDate),
    csv: (row) => fmtDate(row.expiryDate),
  },
  {
    key: 'currency',
    label: 'Currency',
    width: '70px',
    render: (row) => row.currency ?? '—',
    csv: (row) => row.currency ?? '',
  },
  rightAmount('sumInsured100', '100% Sum Insured', (row) => row.sumInsured),
  rightAmount('premium100', '100% Premium', (row) => row.premium, '130px'),
  {
    key: 'facShare',
    label: 'Fac. Share',
    width: '80px',
    className: 'text-right',
    render: (row) => (row.facultativeOfferPercent != null ? `${row.facultativeOfferPercent}%` : '—'),
    csv: (row) => (row.facultativeOfferPercent != null ? `${row.facultativeOfferPercent}%` : ''),
  },
  rightAmount('facSumInsured', 'Fac Sum Insured', (row) => fac(row).facSumInsured),
  rightAmount('facPremium', 'Fac Premium', (row) => fac(row).facPremium, '130px'),
  rightAmount('paidFacPremium', 'Paid Fac Premium', (row) => fac(row).paidFacPremium),
  {
    key: 'cedantCommissionPct',
    label: 'Cedant Commission (%)',
    width: '110px',
    className: 'text-right',
    render: (row) => {
      const pct = fac(row).cedantCommissionPercent;
      return pct != null ? `${pct}%` : '—';
    },
    csv: (row) => {
      const pct = fac(row).cedantCommissionPercent;
      return pct != null ? `${pct}%` : '';
    },
  },
  rightAmount('cedantCommissionAmount', 'Cedant Commission', (row) => fac(row).cedantCommissionAmount),
  rightAmount('netPremiumDueIrisk', 'Net Premium Due iRisk', (row) => fac(row).netPremiumDueIrisk, '150px'),
  rightAmount(
    'netPremiumDueIriskPaid',
    'Net Premium Due iRisk Paid',
    (row) => fac(row).netPremiumDueIriskPaid,
    '160px',
  ),
  rightAmount('brokerage', 'Brokerage', (row) => fac(row).brokerage, '120px'),
  rightAmount('brokeragePaid', 'Brokerage Paid', (row) => fac(row).brokeragePaid, '130px'),
  rightAmount(
    'netPremiumDueReinsurer',
    'Net Premium Due Reinsurer',
    (row) => fac(row).netPremiumDueReinsurer,
    '160px',
  ),
  rightAmount(
    'netPremiumDueReinsurerPaid',
    'Net Premium Due Reinsurer Paid',
    (row) => fac(row).netPremiumDueReinsurerPaid,
    '170px',
  ),
  {
    key: 'offerStatus',
    label: 'Offer Status',
    width: '100px',
    render: (row) => (
      <Badge label={facultativeStatusLabel(row.status)} variant={STATUS_VARIANT_MAP[row.status]} />
    ),
    csv: (row) => facultativeStatusLabel(row.status),
  },
  {
    key: 'paymentStatus',
    label: 'Payment Status',
    width: '120px',
    render: (row) => (
      <Badge label={row.paymentStatus} variant={PAYMENT_STATUS_VARIANT_MAP[row.paymentStatus]} />
    ),
    csv: (row) => row.paymentStatus,
  },
];

const re = (row: FacultativeReportDisplayRow) => row.scopeReinsurer;

// One row per accepted reinsurer, carrying that reinsurer's own share / financials.
const REINSURER_SCOPE_COLUMNS: ReportColumn[] = [
  POLICY_NUMBER_COLUMN,
  {
    key: 'reinsurer',
    label: 'Reinsurer',
    width: 'minmax(120px, 0.8fr)',
    render: (row) => {
      const name = re(row)?.reinsurerName;
      return name ? <span className="font-semibold text-gray-900">{name}</span> : <Muted>—</Muted>;
    },
    csv: (row) => re(row)?.reinsurerName ?? '',
  },
  {
    key: 'reinsured',
    label: 'Reinsured',
    width: 'minmax(120px, 0.8fr)',
    render: (row) => <span className="text-gray-700">{row.cedantName}</span>,
    csv: (row) => row.cedantName,
  },
  INSURED_COLUMN,
  BUSINESS_NAME_COLUMN,
  dateCol('offerDate', 'Offer Date', (row) => row.offerDate),
  dateCol('closedAt', 'Date Closed', (row) => re(row)?.closedAt ?? row.closedAt),
  dateCol('startDate', 'Start Date', (row) => row.inceptionDate),
  dateCol('endDate', 'End Date', (row) => row.expiryDate),
  CURRENCY_COLUMN,
  rightAmount('sumInsured100', '100% Sum Insured', (row) => row.sumInsured),
  rightAmount('premium100', '100% Premium', (row) => row.premium, '130px'),
  {
    key: 'facShare',
    label: 'Fac. Share',
    width: '80px',
    className: 'text-right',
    render: (row) => {
      const s = re(row)?.sharePercent;
      return s != null ? `${s}%` : '—';
    },
    csv: (row) => {
      const s = re(row)?.sharePercent;
      return s != null ? `${s}%` : '';
    },
  },
  rightAmount('facSumInsured', 'Fac Sum Insured', (row) => re(row)?.facSumInsured ?? null),
  rightAmount('facPremium', 'Fac Premium', (row) => re(row)?.facPremium ?? null, '130px'),
  rightAmount('paidFacPremium', 'Paid Fac Premium', (row) => re(row)?.paidFacPremium ?? null),
  rightAmount('brokerage', 'Brokerage', (row) => re(row)?.brokerage ?? null, '120px'),
  rightAmount('brokeragePaid', 'Brokerage Paid', (row) => re(row)?.brokeragePaid ?? null, '130px'),
  rightAmount('wht', 'WHT', (row) => re(row)?.withholdingTax ?? null, '110px'),
  rightAmount('whtPaid', 'Paid WHT', (row) => re(row)?.withholdingTaxPaid ?? null, '110px'),
  rightAmount('nicLevy', 'NIC Levy', (row) => re(row)?.nicLevy ?? null, '110px'),
  rightAmount('nicLevyPaid', 'Paid NIC', (row) => re(row)?.nicLevyPaid ?? null, '110px'),
  rightAmount(
    'netPremiumDueReinsurer',
    'Net Premium Due Reinsurer',
    (row) => re(row)?.netPremiumDueReinsurer ?? null,
    '160px',
  ),
  rightAmount('netPremiumPaid', 'Net Premium Paid', (row) => re(row)?.netPremiumPaid ?? null, '150px'),
  OFFER_STATUS_COLUMN,
  PAYMENT_STATUS_COLUMN,
];

const COLUMNS_BY_SCOPE: Record<FacultativeReportScope, ReportColumn[]> = {
  cedant: CEDANT_SCOPE_COLUMNS,
  reinsurer: REINSURER_SCOPE_COLUMNS,
};

export function FacultativeReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [dateField, setDateField] = useState<FacultativeReportDateField>('createdAt');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(todayISODate());
  const [riskClassIds, setRiskClassIds] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
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

  const { rows, isLoading } = useFacultativeReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    setReportParams({
      dateField,
      startDate,
      endDate,
      riskClassIds: riskClassIds.length ? riskClassIds : undefined,
      currencies: currencies.length ? currencies : undefined,
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

  // Cedants scope: one row per placement. Reinsurer scope: one row per accepted
  // reinsurer — placements with no reinsurers are dropped — then narrow to the
  // selected reinsurers.
  const displayRows = useMemo<FacultativeReportDisplayRow[]>(() => {
    if (scope === 'cedant') return rows.map((r) => flattenRow(r, null));

    const flat = rows.flatMap((r) => r.reinsurers.map((re) => flattenRow(r, re)));
    if (reinsurerIds.length) {
      const selected = new Set(reinsurerIds);
      return flat.filter(
        (row) => row.scopeReinsurer != null && selected.has(row.scopeReinsurer.reinsurerId),
      );
    }
    return flat;
  }, [rows, scope, reinsurerIds]);

  const { page, setPage, totalPages, pagedRows, rowsPerPageControl } =
    useReportPagination(displayRows);

  const handleExport = () => {
    const headers = columns.map((c) => c.label);
    const data = displayRows.map((row) => columns.map((c) => c.csv?.(row) ?? ''));
    exportToCsv(`facultative-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={pagedRows}
          isLoading={reportParams !== null && isLoading}
          onRowClick={(row) =>
            router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.id}`)
          }
          onExport={reportParams && displayRows.length > 0 ? handleExport : undefined}
          toolbarTrailing={rowsPerPageControl}
          extraFilters={
            // w-full forces the filter group to own the first toolbar line, so the
            // Export / Run Filter buttons (rendered by DataTable after a flex-1 spacer)
            // always wrap onto a second line and sit flush right at its end.
            <div className="flex w-full items-center gap-2 flex-wrap">
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
                <MultiSelect
                  size="sm"
                  variant="inline"
                  placeholder="Currency"
                  options={currencyOptions}
                  value={currencies}
                  onChange={setCurrencies}
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
              <div className="w-30">
                <SearchSelect
                  size="sm"
                  disableClear
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
