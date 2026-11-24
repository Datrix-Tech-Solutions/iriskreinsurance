'use client';

import { useMemo, useState } from 'react';
import { reportCurrencyOptions } from '@/lib/reinsurance/reportCurrencies';
import { useAppliedReportParams } from '@/hooks/reinsurance/useAppliedReportParams';
import {
  businessExchangeReportKey,
  downloadBusinessExchangeReportCsv,
  downloadBusinessExchangeReportExcel,
  useBusinessExchangeReport,
  type BusinessExchangeMode,
  type BusinessExchangeReportParams,
  type BusinessExchangeReportRow,
} from '@/hooks/reinsurance/useBusinessExchangeReport';
import { useCurrencyOptions } from '@/hooks';
import { ReportQueryError } from '@/components/molecules/reinsurance/reports/ReportQueryError';
import { ReportRowsSummary } from '@/components/molecules/reinsurance/reports/ReportRowsSummary';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { datedReportFilename, downloadReportBlob } from '@/lib/reinsurance/downloadReportExport';

const ALL = 'ALL';
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

const MODE_OPTIONS: { value: BusinessExchangeMode; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_OPTIONS = [
  { value: ALL, label: 'All months' },
  ...MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label })),
];

function yearOptions(includeAll: boolean) {
  const current = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => {
    const year = String(current - i);
    return { value: year, label: year };
  });
  return includeAll ? [{ value: ALL, label: 'All years' }, ...years] : years;
}

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  return month ? `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}` : period;
}

type Row = BusinessExchangeReportRow & { id: string };

export function BusinessExchangeReportTable() {
  // Staged filter values — only applied once "Run Filter" is clicked.
  const [mode, setMode] = useState<BusinessExchangeMode>('monthly');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(ALL);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [reportParams, setReportParams] =
    useAppliedReportParams<BusinessExchangeReportParams>(businessExchangeReportKey);
  const [pageSize, setPageSize] = useState(50);

  const { data: currencyMetadataOptions = [] } = useCurrencyOptions();
  const { rows, summary, isLoading, isError, error, refetch, meta } = useBusinessExchangeReport(
    reportParams ?? {},
    { enabled: reportParams !== null },
  );

  const currencyOptions = reportCurrencyOptions(
    currencyMetadataOptions,
    summary.totalsByCurrency.map((row) => row.currency),
  );

  const handleModeChange = (value: string) => {
    const next = value as BusinessExchangeMode;
    setMode(next);
    // Monthly always needs a concrete year; yearly may span all years.
    if (next === 'monthly' && year === ALL) setYear(String(new Date().getFullYear()));
  };

  const handleRunFilter = () => {
    setReportParams({
      mode,
      year: year === ALL ? undefined : Number(year),
      month: mode === 'monthly' && month !== ALL ? Number(month) : undefined,
      currencies: currencies.length ? currencies : undefined,
      sortBy: 'insuranceCompany',
      sortOrder: 'asc',
      page: 1,
      limit: pageSize,
    });
  };

  const columns: Column<Row>[] = useMemo(
    () => [
      { key: 'insuranceCompany', label: 'Insurance Company', width: 'minmax(180px, 1fr)' },
      { key: 'currency', label: 'Currency', width: '90px' },
      {
        key: 'period',
        label: 'Period',
        width: '130px',
        render: (row) => formatPeriod(row.period),
      },
      {
        key: 'volumeGiven',
        label: 'Volume of Business Given',
        width: '160px',
        render: (row) => row.volumeGiven.toLocaleString(),
      },
      {
        key: 'volumeReceived',
        label: 'Volume of Business Received',
        width: '170px',
        render: (row) => row.volumeReceived.toLocaleString(),
      },
      {
        key: 'businessReceived',
        label: 'Business Received (Premium)',
        width: '180px',
        render: (row) => formatAmount(row.businessReceived),
      },
      {
        key: 'netBalance',
        label: 'Net Balance',
        width: '140px',
        render: (row) => (
          <span className={row.netBalance < 0 ? 'text-red-600' : undefined}>
            {formatAmount(row.netBalance)}
          </span>
        ),
      },
      {
        key: 'netBrokerage',
        label: 'Net Brokerage',
        width: '140px',
        render: (row) => formatAmount(row.netBrokerage),
      },
    ],
    [],
  );

  const data = useMemo<Row[]>(
    () => rows.map((r) => ({ ...r, id: `${r.insuranceCompany}|${r.currency}|${r.period}` })),
    [rows],
  );

  const handlePageChange = (nextPage: number) => {
    setReportParams((prev) => (prev ? { ...prev, page: nextPage, limit: pageSize } : prev));
  };

  const rowsPerPageControl =
    reportParams && meta.total > 10 ? (
      <label className="flex items-center gap-1.5 text-sm text-gray-500">
        Rows
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const nextPageSize = Number(e.target.value);
            setPageSize(nextPageSize);
            setReportParams((prev) => (prev ? { ...prev, page: 1, limit: nextPageSize } : prev));
          }}
          className="appearance-none rounded-input border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-(--focus-ring,var(--color-gray-400))"
        >
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <option key={opt} value={String(opt)}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  const handleExport = async () => {
    if (!reportParams) return;
    const blob = await downloadBusinessExchangeReportCsv(reportParams);
    downloadReportBlob(blob, datedReportFilename('business-exchange-report', 'csv'));
  };

  const handleExportExcel = async () => {
    if (!reportParams) return;
    const blob = await downloadBusinessExchangeReportExcel(reportParams);
    downloadReportBlob(blob, datedReportFilename('business-exchange-report', 'xls'));
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {reportParams && !isError && summary.totalsByCurrency.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.totalsByCurrency.map((totals) => (
            <div key={totals.currency} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold text-gray-500">{totals.currency}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-gray-500">Given</dt>
                <dd className="text-right">{totals.volumeGiven.toLocaleString()}</dd>
                <dt className="text-gray-500">Received</dt>
                <dd className="text-right">{totals.volumeReceived.toLocaleString()}</dd>
                <dt className="text-gray-500">Business received</dt>
                <dd className="text-right">{formatAmount(totals.businessReceived)}</dd>
                <dt className="text-gray-500">Net balance</dt>
                <dd className="text-right">{formatAmount(totals.netBalance)}</dd>
                <dt className="text-gray-500">Net brokerage</dt>
                <dd className="text-right">{formatAmount(totals.netBrokerage)}</dd>
              </dl>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={data}
          headerClassName="text-[8px]"
          rowClassName="text-[10px]"
          toolbarTrailing={
            reportParams ? (
              <div className="flex items-center gap-3">
                <ReportRowsSummary
                  page={meta.page}
                  pageSize={pageSize}
                  shown={rows.length}
                  total={meta.total}
                  isLoading={isLoading}
                />
                {rowsPerPageControl}
              </div>
            ) : undefined
          }
          isLoading={reportParams !== null && isLoading}
          errorContent={
            reportParams && isError ? (
              <ReportQueryError error={error} onRetry={() => void refetch()} />
            ) : undefined
          }
          exportOptions={
            reportParams && !isError && meta.total > 0
              ? [
                  { label: 'CSV', onClick: handleExport },
                  { label: 'Excel', onClick: handleExportExcel },
                ]
              : undefined
          }
          extraFilters={
            <div className="flex w-full items-center gap-2 flex-wrap">
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  placeholder="Period"
                  options={MODE_OPTIONS}
                  value={mode}
                  onChange={handleModeChange}
                />
              </div>
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  placeholder="Year"
                  options={yearOptions(mode === 'yearly')}
                  value={year}
                  onChange={setYear}
                />
              </div>
              {mode === 'monthly' && (
                <div className="w-40">
                  <SearchSelect
                    size="sm"
                    placeholder="Month"
                    options={MONTH_OPTIONS}
                    value={month}
                    onChange={setMonth}
                  />
                </div>
              )}
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
            </div>
          }
          actionButton={{ label: 'Run Filter', onClick: handleRunFilter }}
          emptyMessage={
            reportParams
              ? 'No business exchange for the selected period'
              : 'Select a period and click Run Filter to generate the report'
          }
          rowNumber={(_row, index) => (meta.page - 1) * meta.limit + index + 1}
          currentPage={meta.page}
          totalPages={isError ? 0 : Math.max(1, meta.totalPages)}
          onPageChange={handlePageChange}
          noInternalScroll
        />
      </div>
    </div>
  );
}
