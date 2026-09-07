'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import {
  useCedantOptions,
  useReinsurerOptions,
  useCurrencyOptions,
  useClaimsReport,
} from '@/hooks';
import {
  ClaimReportRow,
  ClaimReinsurerBreakdown,
  ClaimsReportBucket,
  ClaimsReportParams,
} from '@/hooks/reinsurance/useClaimsReport';
import { exportToCsv } from '@/lib/exportCsv';

const PAGE_SIZE = 10;
const MS_PER_DAY = 86_400_000;

const BUCKET_OPTIONS: { value: ClaimsReportBucket; label: string }[] = [
  { value: 'notification', label: 'Notification' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'finalized', label: 'Finalized' },
];

// Shown only when Stage = Finalized. Buckets a finalized claim by how much of iRisk's
// share has been recovered.
const PAYMENT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'part', label: 'Part Payment' },
  { value: 'full', label: 'Full Payment' },
  { value: 'outstanding', label: 'Outstanding' },
];

type ClaimsReportScope = 'general' | 'cedant' | 'reinsurer';

const SCOPE_OPTIONS: { value: ClaimsReportScope; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'cedant', label: 'Cedants' },
  { value: 'reinsurer', label: 'Reinsurer' },
];

/* ── formatting ── */

function fmtAmount(value: number | null, currency: string): string {
  if (value == null) return '—';
  return `${currency} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

function fmtPct(value: number | null): string {
  return value == null ? '—' : `${Number(value)}%`;
}

function fmtInt(value: number | null): string {
  return value == null ? '—' : String(value);
}

/** Whole days between `fromIso` and `toIso` (or now), floored at 0. */
function daysBetween(fromIso: string | null, toIso: string | null): number | null {
  if (!fromIso) return null;
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  return Math.max(0, Math.floor((to - new Date(fromIso).getTime()) / MS_PER_DAY));
}

/** Date of loss minus first premium payment date, in days — negative when the loss
 *  occurred before the premium was paid. */
function dolDopDays(lossIso: string | null, premiumIso: string | null): number | null {
  if (!lossIso || !premiumIso) return null;
  return Math.floor((new Date(lossIso).getTime() - new Date(premiumIso).getTime()) / MS_PER_DAY);
}

/* ── display row ──
 * Flat shape the table renders. For the General and Reinsurer scopes a claim is
 * exploded into one row per reinsurer, with the shared cells repeated; the Cedants
 * scope keeps one row per claim (reinsurer fields null). */
interface ClaimReportDisplayRow {
  id: string;
  claimId: string;
  placementId: string;
  bucket: ClaimsReportBucket;
  policyNumber: string;
  businessName: string;
  cedantName: string;
  policyType: string | null;
  claimType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  claimNumber: string;
  currency: string;
  occurrenceDate: string;
  premiumPaidAt: string | null;
  claimAmount: number;
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

function flattenRow(
  r: ClaimReportRow,
  reinsurer: ClaimReinsurerBreakdown | null,
): ClaimReportDisplayRow {
  return {
    id: reinsurer ? `${r.id}:${reinsurer.reinsurerId}` : r.id,
    claimId: r.id,
    placementId: r.placementId,
    bucket: r.bucket,
    policyNumber: r.policyNumber,
    businessName: r.businessName,
    cedantName: r.cedantName,
    policyType: r.policyType,
    claimType: r.claimType,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    claimNumber: r.claimNumber,
    currency: r.currency,
    occurrenceDate: r.occurrenceDate,
    premiumPaidAt: r.premiumPaidAt,
    claimAmount: r.claimAmount,
    iriskSharePercent: r.iriskSharePercent,
    iriskShareAmount: r.iriskShareAmount,
    iriskSharePaid: r.iriskSharePaid,
    iriskShareOutstanding: r.iriskShareOutstanding,
    reinsurerId: reinsurer?.reinsurerId ?? null,
    reinsurerName: reinsurer?.reinsurerName ?? null,
    reinsurerSharePercent: reinsurer?.sharePercent ?? null,
    reinsurerShareAmount: reinsurer?.shareAmount ?? null,
    reinsurerPaidAmount: reinsurer?.paidAmount ?? null,
    reinsurerOutstandingAmount: reinsurer?.outstandingAmount ?? null,
    // Reinsurer rows carry that reinsurer's recovery aging; base rows use the claim's.
    agingDays: reinsurer ? reinsurer.agingDays : daysBetween(r.finalizedAt, r.recoveredAt),
    dolDop: dolDopDays(r.occurrenceDate, r.premiumPaidAt),
  };
}

/* ── columns ──
 * `csv` regenerates the export for whichever scope is active; DataTable ignores it. */
type ReportColumn = Column<ClaimReportDisplayRow> & {
  csv?: (row: ClaimReportDisplayRow) => string | number;
};

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-gray-400">{children}</span>
);

const BASE_COLUMNS: ReportColumn[] = [
  {
    key: 'businessName',
    label: 'Business Name',
    width: '130px',
    render: (row) =>
      row.businessName ? (
        <span className="text-gray-700">{row.businessName}</span>
      ) : (
        <Muted>—</Muted>
      ),
    csv: (row) => row.businessName ?? '',
  },
  {
    key: 'cedantName',
    label: 'Cedant',
    width: '130px',
    render: (row) => <span className="text-gray-700">{row.cedantName}</span>,
    csv: (row) => row.cedantName,
  },
  {
    key: 'policyType',
    label: 'Policy Type',
    width: '120px',
    render: (row) => row.policyType ?? <Muted>—</Muted>,
    csv: (row) => row.policyType ?? '',
  },
  {
    key: 'policyNumber',
    label: 'Policy Number',
    width: '130px',
    render: (row) => <EndorsedReferencePill id={row.placementId} reference={row.policyNumber} />,
    csv: (row) => row.policyNumber,
  },
  {
    key: 'claimType',
    label: 'Claim Type',
    width: '120px',
    render: (row) => row.claimType ?? <Muted>—</Muted>,
    csv: (row) => row.claimType ?? '',
  },
  {
    key: 'claimNumber',
    label: 'Claim Number',
    width: '100px',
    render: (row) => <span className="font-medium text-gray-900">{row.claimNumber}</span>,
    csv: (row) => row.claimNumber,
  },
  {
    key: 'periodOfInsurance',
    label: 'Period of Insurance',
    width: '150px',
    render: (row) => fmtPeriod(row.periodStart, row.periodEnd),
    csv: (row) => fmtPeriod(row.periodStart, row.periodEnd),
  },
  {
    key: 'dateOfLoss',
    label: 'Date of Loss',
    width: '90px',
    render: (row) => fmtDate(row.occurrenceDate),
    csv: (row) => fmtDate(row.occurrenceDate),
  },
  {
    key: 'currency',
    label: 'Currency',
    width: '50px',
    render: (row) => row.currency,
    csv: (row) => row.currency,
  },
  {
    key: 'claimAmount',
    label: 'Claim Amount',
    width: '130px',
    className: 'text-right',
    render: (row) => fmtAmount(row.claimAmount, row.currency),
    csv: (row) => row.claimAmount,
  },
];

const IRISK_COLUMNS: ReportColumn[] = [
  {
    key: 'iriskSharePct',
    label: 'iRisk Share %',
    width: '70px',
    className: 'text-right',
    render: (row) => fmtPct(row.iriskSharePercent),
    csv: (row) => row.iriskSharePercent ?? '',
  },
  {
    key: 'iriskShareAmount',
    label: 'iRisk Share Amount',
    width: '130px',
    className: 'text-right',
    render: (row) => fmtAmount(row.iriskShareAmount, row.currency),
    csv: (row) => row.iriskShareAmount ?? '',
  },
  {
    key: 'iriskSharePaid',
    label: 'iRisk Share Paid',
    width: '130px',
    className: 'text-right',
    render: (row) => fmtAmount(row.iriskSharePaid, row.currency),
    csv: (row) => row.iriskSharePaid ?? '',
  },
  {
    key: 'iriskShareOutstanding',
    label: 'iRisk Share Outstanding',
    width: '130px',
    className: 'text-right',
    render: (row) => fmtAmount(row.iriskShareOutstanding, row.currency),
    csv: (row) => row.iriskShareOutstanding ?? '',
  },
];

// One row per reinsurer on the claim — these columns hold that reinsurer's figures.
// `plural` only switches header wording for the General scope (block sits next to iRisk).
const reinsurerColumns = (plural: boolean): ReportColumn[] => {
  const p = plural ? 'Reinsurer(s)' : 'Reinsurer';
  return [
    {
      key: 'reinsurerName',
      label: `${p} Name`,
      width: '130px',
      render: (row) =>
        row.reinsurerName ? (
          <span className="text-gray-700">{row.reinsurerName}</span>
        ) : (
          <Muted>—</Muted>
        ),
      csv: (row) => row.reinsurerName ?? '',
    },
    {
      key: 'reinsurerSharePct',
      label: `${p} % Share`,
      width: '120px',
      className: 'text-right',
      render: (row) => fmtPct(row.reinsurerSharePercent),
      csv: (row) => row.reinsurerSharePercent ?? '',
    },
    {
      key: 'reinsurerShareAmount',
      label: `${p} Share (Amount)`,
      width: '130px',
      className: 'text-right',
      render: (row) => fmtAmount(row.reinsurerShareAmount, row.currency),
      csv: (row) => row.reinsurerShareAmount ?? '',
    },
    {
      key: 'reinsurerAmountPaid',
      label: `${p} Amount Paid`,
      width: '130px',
      className: 'text-right',
      render: (row) => fmtAmount(row.reinsurerPaidAmount, row.currency),
      csv: (row) => row.reinsurerPaidAmount ?? '',
    },
    {
      key: 'reinsurerAmountOutstanding',
      label: `${p} Amount Outstanding`,
      width: '150px',
      className: 'text-right',
      render: (row) => fmtAmount(row.reinsurerOutstandingAmount, row.currency),
      csv: (row) => row.reinsurerOutstandingAmount ?? '',
    },
  ];
};

const AGING_COLUMN: ReportColumn = {
  key: 'agingDays',
  label: 'Aging (days)',
  width: '50px',
  className: 'text-right',
  render: (row) => <span className="text-gray-700">{fmtInt(row.agingDays)}</span>,
  csv: (row) => row.agingDays ?? '',
};

// Date of loss vs. first premium payment date, in days (negative when the loss
// predates payment).
const DOL_DOP_COLUMN: ReportColumn = {
  key: 'dolDop',
  label: 'DoL:DoP',
  width: '50px',
  className: 'text-right',
  render: (row) => <span className="text-gray-700">{fmtInt(row.dolDop)}</span>,
  csv: (row) => row.dolDop ?? '',
};

const TAIL_COLUMNS: ReportColumn[] = [AGING_COLUMN, DOL_DOP_COLUMN];

const COLUMNS_BY_SCOPE: Record<ClaimsReportScope, ReportColumn[]> = {
  general: [...BASE_COLUMNS, ...IRISK_COLUMNS, ...reinsurerColumns(true), ...TAIL_COLUMNS],
  cedant: [...BASE_COLUMNS, ...IRISK_COLUMNS, ...TAIL_COLUMNS],
  reinsurer: [...BASE_COLUMNS, ...reinsurerColumns(false), ...TAIL_COLUMNS],
};

export function ClaimsReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [page, setPage] = useState(1);

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('');
  const [bucket, setBucket] = useState('');
  const [stage, setStage] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [scope, setScope] = useState<ClaimsReportScope>('general');
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reinsurerIds, setReinsurerIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<ClaimsReportParams | null>(null);

  const { options: cedantOptions } = useCedantOptions();
  const { options: reinsurerOptions } = useReinsurerOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const handleScopeChange = (value: string) => {
    setScope(value as ClaimsReportScope);
    setCedantIds([]);
    setReinsurerIds([]);
    setPage(1);
  };

  const handleStageChange = (value: string) => {
    setStage(value);
    if (value !== 'finalized') setPaymentStatus('');
    setPage(1);
  };

  const { rows, isLoading } = useClaimsReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    setReportParams({
      startDate,
      endDate,
      currency: currency || undefined,
      bucket: (bucket || undefined) as ClaimsReportBucket | undefined,
      cedantIds: scope === 'cedant' && cedantIds.length ? cedantIds : undefined,
    });
    setPage(1);
  };

  // Column set depends on the selected scope — General shows both the iRisk and
  // reinsurer share blocks, Cedants drops the reinsurer block, Reinsurer drops iRisk.
  const columns = useMemo<ReportColumn[]>(() => COLUMNS_BY_SCOPE[scope], [scope]);

  // Stage (Pending/Finalized) and, when Finalized, iRisk-share payment status.
  const stageFilteredRows = useMemo<ClaimReportRow[]>(() => {
    return rows.filter((r) => {
      const finalized = r.finalizedAt != null;
      if (stage === 'pending') return !finalized;
      if (stage === 'finalized') {
        if (!finalized) return false;
        if (!paymentStatus) return true;
        const paid = r.iriskSharePaid ?? 0;
        const isFull = r.bucket === 'closed';
        const isOutstanding = !isFull && paid <= 0.01;
        const isPart = !isFull && !isOutstanding;
        if (paymentStatus === 'full') return isFull;
        if (paymentStatus === 'part') return isPart;
        return isOutstanding;
      }
      return true;
    });
  }, [rows, stage, paymentStatus]);

  // Explode per reinsurer for General/Reinsurer; keep one row per claim for Cedants.
  const displayRows = useMemo<ClaimReportDisplayRow[]>(() => {
    const flat =
      scope === 'cedant'
        ? stageFilteredRows.map((r) => flattenRow(r, null))
        : stageFilteredRows.flatMap((r) =>
            r.reinsurers.length
              ? r.reinsurers.map((re) => flattenRow(r, re))
              : [flattenRow(r, null)],
          );

    if (scope === 'reinsurer' && reinsurerIds.length) {
      const selected = new Set(reinsurerIds);
      return flat.filter((row) => row.reinsurerId != null && selected.has(row.reinsurerId));
    }
    return flat;
  }, [stageFilteredRows, scope, reinsurerIds]);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const paged = displayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    const headers = columns.map((c) => c.label);
    const data = displayRows.map((row) => columns.map((c) => c.csv?.(row) ?? ''));
    exportToCsv(`claims-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={paged}
          isLoading={reportParams !== null && isLoading}
          onRowClick={(row) =>
            router.push(
              `/${tenantSlug}/operations/reinsurance/claims/${row.claimId}?placementId=${row.placementId}&tab=${row.bucket}`,
            )
          }
          onExport={reportParams && displayRows.length > 0 ? handleExport : undefined}
          extraFilters={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder="Period start"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder="Period end"
                  value={endDate}
                  minDate={startDate || undefined}
                  onChange={setEndDate}
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
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Status"
                  options={BUCKET_OPTIONS}
                  value={bucket}
                  onChange={setBucket}
                />
              </div>
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Stages"
                  options={STAGE_OPTIONS}
                  value={stage}
                  onChange={handleStageChange}
                />
              </div>
              {stage === 'finalized' && (
                <div className="w-40">
                  <SearchSelect
                    size="sm"
                    showAllOption
                    placeholder="Payment status"
                    options={PAYMENT_STATUS_OPTIONS}
                    value={paymentStatus}
                    onChange={(value) => {
                      setPaymentStatus(value);
                      setPage(1);
                    }}
                  />
                </div>
              )}
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
              ? 'No claims activity for the selected filters'
              : 'Select a period and click Run Filter to generate the report'
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
