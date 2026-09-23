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
  useRiskTypeOptions,
  useCurrencyOptions,
  useBrokerageReport,
} from '@/hooks';
import {
  BrokerageReportRow,
  BrokerageReportParams,
  downloadBrokerageReportCsv,
  downloadBrokerageReportExcel,
} from '@/hooks/reinsurance/useBrokerageReport';
import { CedantPaymentStatus } from '@/lib/reinsurance/placementStatus';
import { todayISODate } from '@/lib/reinsurance/reportDates';
import {
  datedReportFilename,
  downloadReportBlob,
  downloadReportText,
} from '@/lib/reinsurance/downloadReportExport';

const PAYMENT_STATUS_OPTIONS: { value: CedantPaymentStatus; label: string }[] = [
  { value: 'Outstanding', label: 'Outstanding' },
  // { value: 'Pending', label: 'Pending' },
  { value: 'Part Payment', label: 'Part Payment' },
  { value: 'Paid', label: 'Paid' },
];

// A placement viewed from either the cedant side (one aggregated row, brokerage
// summed across reinsurers) or the reinsurer side (one row per accepted reinsurer).
type BrokerageReportScope = 'cedant' | 'reinsurer';

const SCOPE_OPTIONS: { value: BrokerageReportScope; label: string }[] = [
  { value: 'cedant', label: 'Cedants' },
  { value: 'reinsurer', label: 'Reinsurer' },
];

/* ── formatting ── */

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

function fmtPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-gray-400">{children}</span>
);

function fmtRate(value: number | null): string {
  return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/* ── columns ── */
type ReportColumn = Column<BrokerageReportRow>;

const POLICY_NUMBER_COLUMN: ReportColumn = {
  key: 'policyNumber',
  label: 'Policy Number',
  width: '130px',
  render: (row) => (
    <EndorsedReferencePill
      id={row.placementId}
      reference={row.policyNumber ?? row.placementId}
      textClassName="text-[10px]"
    />
  ),
};

const REINSURER_NAME_COLUMN: ReportColumn = {
  key: 'reinsurerName',
  label: 'Reinsurer',
  width: '150px',
  render: (row) =>
    row.reinsurerName ? (
      <span className="text-gray-700">{row.reinsurerName}</span>
    ) : (
      <Muted>—</Muted>
    ),
};

// Placement-level cells plus the fac-premium / brokerage figures — shared by both
// scopes (summed across reinsurers under Cedants, per-reinsurer under Reinsurer).
const SHARED_COLUMNS: ReportColumn[] = [
  {
    key: 'insured',
    label: 'Insured',
    width: 'minmax(140px, 1fr)',
    render: (row) => <span className="text-gray-700">{row.title}</span>,
  },
  {
    key: 'policyType',
    label: 'Policy Type',
    width: '100px',
    render: (row) => row.policyType ?? <Muted>—</Muted>,
  },
  {
    key: 'cedantName',
    label: 'Cedants',
    width: 'minmax(120px, 1fr)',
    render: (row) => <span className="text-gray-700">{row.cedantName}</span>,
  },
  {
    key: 'periodOfInsurance',
    label: 'Period of Insurance',
    width: '150px',
    render: (row) => fmtPeriod(row.inceptionDate, row.expiryDate),
  },
  {
    key: 'currency',
    label: 'Currency',
    width: '60px',
    render: (row) => row.currency ?? '—',
  },
  {
    key: 'sumInsured100',
    label: '100% S.I',
    width: '110px',
    className: 'text-right',
    render: (row) => fmtAmount(row.sumInsured, row.currency),
  },
  {
    key: 'premium100',
    label: '100% Premium',
    width: '110px',
    className: 'text-right',
    render: (row) => fmtAmount(row.premium, row.currency),
  },
  {
    key: 'facPremium',
    label: 'Fac Premium',
    width: '110px',
    className: 'text-right',
    render: (row) => fmtAmount(row.grossPremium, row.currency),
  },
  {
    key: 'exchangeRate',
    label: 'Exchange Rate',
    width: '90px',
    className: 'text-right',
    render: (row) => fmtRate(row.exchangeRate),
  },
  {
    key: 'brokerageAmount',
    label: 'Full Brokerage Amount',
    width: '130px',
    className: 'text-right',
    render: (row) => fmtAmount(row.brokerageAmount, row.currency),
  },
  {
    key: 'brokeragePaid',
    label: 'Brokerage Paid',
    width: '140px',
    className: 'text-right',
    render: (row) => fmtAmount(row.brokeragePaid, row.currency),
  },
];

// Reinsurer scope only — each reinsurer's tax figures from its credit note.
const REINSURER_TAIL_COLUMNS: ReportColumn[] = [
  {
    key: 'wht',
    label: 'WHT',
    width: '100px',
    className: 'text-right',
    render: (row) => fmtAmount(row.withholdingTax, row.currency),
  },
  {
    key: 'whtPaid',
    label: 'WHT Paid',
    width: '120px',
    className: 'text-right',
    render: (row) => fmtAmount(row.withholdingTaxPaid, row.currency),
  },
  {
    key: 'nicLevy',
    label: 'NIC Levy',
    width: '100px',
    className: 'text-right',
    render: (row) => fmtAmount(row.nicLevy, row.currency),
  },
  {
    key: 'nicLevyPaid',
    label: 'NIC Levy Paid',
    width: '130px',
    className: 'text-right',
    render: (row) => fmtAmount(row.nicLevyPaid, row.currency),
  },
];

const COLUMNS_BY_SCOPE: Record<BrokerageReportScope, ReportColumn[]> = {
  cedant: [POLICY_NUMBER_COLUMN, ...SHARED_COLUMNS],
  reinsurer: [
    POLICY_NUMBER_COLUMN,
    REINSURER_NAME_COLUMN,
    ...SHARED_COLUMNS,
    ...REINSURER_TAIL_COLUMNS,
  ],
};

export function BrokerageReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(todayISODate());
  const [riskTypeIds, setRiskTypeIds] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<string[]>([]);
  const [scope, setScope] = useState<BrokerageReportScope>('reinsurer');
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reinsurerIds, setReinsurerIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<BrokerageReportParams | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { options: cedantOptions } = useCedantOptions();
  const { options: reinsurerOptions } = useReinsurerOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const handleScopeChange = (value: string) => {
    setScope(value as BrokerageReportScope);
    setCedantIds([]);
    setReinsurerIds([]);
    setPage(1);
  };

  const { rows, meta, isLoading } = useBrokerageReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    const nextPage = 1;
    setPage(nextPage);
    setReportParams({
      startDate,
      endDate,
      page: nextPage,
      limit: pageSize,
      riskTypeIds: riskTypeIds.length ? riskTypeIds : undefined,
      currencies: currencies.length ? currencies : undefined,
      paymentStatuses: paymentStatuses.length
        ? (paymentStatuses as CedantPaymentStatus[])
        : undefined,
      cedantIds: scope === 'cedant' && cedantIds.length ? cedantIds : undefined,
      reinsurerIds: scope === 'reinsurer' && reinsurerIds.length ? reinsurerIds : undefined,
      scope,
    });
  };

  const columns = useMemo<ReportColumn[]>(() => COLUMNS_BY_SCOPE[scope], [scope]);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    if (!reportParams) return;
    setReportParams({ ...reportParams, page: nextPage, limit: pageSize });
  };

  const rowsPerPageControl = (
    <select
      value={pageSize}
      onChange={(event) => {
        const nextLimit = Number(event.target.value);
        setPageSize(nextLimit);
        setPage(1);
        if (reportParams) {
          setReportParams({ ...reportParams, page: 1, limit: nextLimit });
        }
      }}
      className="h-8 rounded border border-gray-200 bg-white px-2 text-xs text-gray-600"
      aria-label="Rows per page"
    >
      {[25, 50, 100, 200].map((size) => (
        <option key={size} value={size}>
          {size} rows
        </option>
      ))}
    </select>
  );

  const handleExport = async () => {
    if (!reportParams) return;
    const csv = await downloadBrokerageReportCsv(reportParams);
    downloadReportText(
      csv,
      datedReportFilename('brokerage-report', 'csv'),
      'text/csv;charset=utf-8',
    );
  };

  const handleExportExcel = async () => {
    if (!reportParams) return;
    const blob = await downloadBrokerageReportExcel(reportParams);
    downloadReportBlob(blob, datedReportFilename('brokerage-report', 'xls'));
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={rows}
          headerClassName="text-[8px]"
          rowClassName="text-[10px]"
          isLoading={reportParams !== null && isLoading}
          onRowClick={(row) =>
            router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.placementId}`)
          }
          exportOptions={
            reportParams && rows.length > 0
              ? [
                  { label: 'CSV', onClick: handleExport },
                  { label: 'Excel', onClick: handleExportExcel },
                ]
              : undefined
          }
          toolbarTrailing={rowsPerPageControl}
          extraFilters={
            // w-full forces the filter group to own the first toolbar line, so the
            // Export / Run Filter buttons (rendered by DataTable after a flex-1 spacer)
            // always wrap onto a second line and sit flush right at its end.
            <div className="flex w-full items-center gap-2 flex-wrap">
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
              <div className="w-36">
                <MultiSelect
                  size="sm"
                  variant="inline"
                  placeholder="Risk type"
                  options={riskTypeOptions}
                  value={riskTypeIds}
                  onChange={setRiskTypeIds}
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
              <div className="w-36">
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
              ? 'No brokerage activity for the selected filters'
              : 'Select a period and click Run Filter to generate the report'
          }
          currentPage={page}
          totalPages={meta.totalPages}
          onPageChange={handlePageChange}
          noInternalScroll
        />
      </div>
    </div>
  );
}
