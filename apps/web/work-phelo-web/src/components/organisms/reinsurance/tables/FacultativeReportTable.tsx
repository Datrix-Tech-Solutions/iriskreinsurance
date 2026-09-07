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
  useRiskClassOptions,
  useCurrencyOptions,
  useFacultativeReport,
} from '@/hooks';
import {
  FacultativeReportRow,
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
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<FacultativeReportParams | null>(null);

  const { options: cedantOptions } = useCedantOptions();
  const { data: riskClassOptions = [] } = useRiskClassOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

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
      cedantIds: cedantIds.length ? cedantIds : undefined,
      lifecycle: (lifecycle || undefined) as FacultativeReportLifecycle | undefined,
      paymentStatuses: paymentStatuses.length
        ? (paymentStatuses as CedantPaymentStatus[])
        : undefined,
    });
    setPage(1);
  };

  const columns: Column<FacultativeReportRow>[] = useMemo(
    () => [
      {
        key: 'reference',
        label: 'Policy Number',
        width: '120px',
        render: (row) => (
          <EndorsedReferencePill id={row.id} reference={displayPolicyNumber(row.policyNumber)} />
        ),
      },
      {
        key: 'cedantName',
        label: 'Cedant',
        width: 'minmax(120px, 0.8fr)',
        render: (row) => <span className="font-semibold text-gray-900">{row.cedantName}</span>,
      },
      {
        key: 'riskClassName',
        label: 'Risk Class',
        width: '90px',
        render: (row) => row.riskClassName ?? '—',
      },
      {
        key: 'sumInsured',
        label: 'Sum Insured',
        width: '120px',
        className: 'text-right',
        render: (row) => fmtAmount(row.sumInsured, row.currency),
      },
      {
        key: 'premium',
        label: 'Premium',
        width: '120px',
        className: 'text-right',
        render: (row) => fmtAmount(row.premium, row.currency),
      },
      {
        key: 'commission',
        label: 'Commission',
        width: '70px',
        render: (row) => (row.commission != null ? `${row.commission}%` : '—'),
      },
      {
        key: 'totalAcceptedPercent',
        label: 'Accepted',
        width: '70px',
        render: (row) => `${row.totalAcceptedPercent}%`,
      },
      {
        key: 'reinsurerCount',
        label: 'Reinsurers',
        width: '70px',
        render: (row) => row.reinsurerCount.toLocaleString(),
      },
      {
        key: 'inceptionDate',
        label: 'Inception',
        width: '90px',
        render: (row) => fmtDate(row.inceptionDate),
      },
      {
        key: 'expiryDate',
        label: 'Expiry',
        width: '90px',
        render: (row) => fmtDate(row.expiryDate),
      },
      {
        key: 'paymentStatus',
        label: 'Payment Status',
        width: '110px',
        render: (row) => (
          <Badge
            label={row.paymentStatus}
            variant={PAYMENT_STATUS_VARIANT_MAP[row.paymentStatus]}
          />
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '90px',
        render: (row) => (
          <Badge
            label={facultativeStatusLabel(row.status)}
            variant={STATUS_VARIANT_MAP[row.status]}
          />
        ),
      },
    ],
    [],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    const headers = [
      'Policy Number',
      'Cedant',
      'Risk Class',
      'Sum Insured',
      'Premium',
      'Commission',
      'Accepted %',
      'Reinsurers',
      'Inception',
      'Expiry',
      'Payment Status',
      'Status',
    ];
    const data = rows.map((row) => [
      displayPolicyNumber(row.policyNumber),
      row.cedantName,
      row.riskClassName ?? '',
      fmtAmount(row.sumInsured, row.currency),
      fmtAmount(row.premium, row.currency),
      row.commission != null ? `${row.commission}%` : '',
      `${row.totalAcceptedPercent}%`,
      row.reinsurerCount,
      fmtDate(row.inceptionDate),
      fmtDate(row.expiryDate),
      row.paymentStatus,
      facultativeStatusLabel(row.status),
    ]);
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
          onExport={reportParams && rows.length > 0 ? handleExport : undefined}
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
