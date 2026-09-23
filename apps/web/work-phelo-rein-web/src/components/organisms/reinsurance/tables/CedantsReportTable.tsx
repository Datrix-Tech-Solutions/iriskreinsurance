'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { DatePicker } from '@/components/atoms/DatePicker';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { ReportCurrencySummaryCards } from '@/components/molecules/reinsurance/reports/ReportCurrencySummaryCards';
import {
  useCedantOptions,
  useRiskTypeOptions,
  useCurrencyOptions,
  useCedantsReport,
} from '@/hooks';
import {
  CedantCurrencyAmount,
  CedantReportRow,
  CedantsReportParams,
  downloadCedantsReportCsv,
  downloadCedantsReportExcel,
} from '@/hooks/reinsurance/useCedantsReport';
import { FACULTATIVE_STATUSES, FacultativeStatus } from '@/types/reinsurance';
import { CedantPaymentStatus, facultativeStatusLabel } from '@/lib/reinsurance/placementStatus';
import { todayISODate } from '@/lib/reinsurance/reportDates';
import { datedReportFilename, downloadReportBlob } from '@/lib/reinsurance/downloadReportExport';

const PAYMENT_STATUS_OPTIONS: { value: CedantPaymentStatus; label: string }[] = [
  { value: 'Outstanding', label: 'Outstanding' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Part Payment', label: 'Part Payment' },
  { value: 'Paid', label: 'Paid' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

const STATUS_OPTIONS = FACULTATIVE_STATUSES.map((s) => ({
  value: s,
  label: facultativeStatusLabel(s),
}));

function fmtCurrencyAmount(value: number, currency: string): string {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

function CurrencyAmounts({ amounts }: { amounts: CedantCurrencyAmount[] }) {
  const visible = amounts.filter((item) => Math.abs(item.amount) > 0.0001);
  if (!visible.length) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex flex-col gap-0.5 text-right">
      {visible.map((item) => (
        <span key={item.currency}>{fmtCurrencyAmount(item.amount, item.currency)}</span>
      ))}
    </div>
  );
}

export function CedantsReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(todayISODate());
  const [riskTypeIds, setRiskTypeIds] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<string[]>([]);
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<CedantsReportParams | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { options: cedantOptions } = useCedantOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const { rows, currencyTotals, isLoading, meta } = useCedantsReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    const nextPage = 1;
    setPage(nextPage);
    setReportParams({
      startDate,
      endDate,
      riskTypeIds: riskTypeIds.length ? riskTypeIds : undefined,
      currencies: currencies.length ? currencies : undefined,
      statuses: statuses.length ? (statuses as FacultativeStatus[]) : undefined,
      paymentStatuses: paymentStatuses.length
        ? (paymentStatuses as CedantPaymentStatus[])
        : undefined,
      cedantIds: cedantIds.length ? cedantIds : undefined,
      page: nextPage,
      limit: pageSize,
    });
  };

  const columns: Column<CedantReportRow & { id: string }>[] = useMemo(
    () => [
      { key: 'name', label: 'Cedant', width: 'minmax(150px, 1fr)' },
      {
        key: 'placementCount',
        label: 'Offers',
        width: '100px',
        render: (row) => row.placementCount.toLocaleString(),
      },
      {
        key: 'totalPremium',
        label: 'Total Premium',
        width: '150px',
        render: (row) => <CurrencyAmounts amounts={row.totalPremiumByCurrency} />,
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        width: '150px',
        render: (row) => <CurrencyAmounts amounts={row.outstandingByCurrency} />,
      },
      {
        key: 'pending',
        label: 'Pending',
        width: '150px',
        render: (row) =>
          row.pending > 0.0001 ? (
            <div className="text-amber-600 font-medium">
              <CurrencyAmounts amounts={row.pendingByCurrency} />
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
    ],
    [],
  );

  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.cedantId })), [rows]);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
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
            setPage(1);
            setReportParams((prev) => (prev ? { ...prev, page: 1, limit: nextPageSize } : prev));
          }}
          className="appearance-none rounded-input border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-(--focus-ring,var(--color-gray-400))"
        >
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  const handleExport = async () => {
    if (!reportParams) return;
    const blob = await downloadCedantsReportCsv(reportParams);
    downloadReportBlob(blob, datedReportFilename('cedants-report', 'csv'));
  };

  const handleExportExcel = async () => {
    if (!reportParams) return;
    const blob = await downloadCedantsReportExcel(reportParams);
    downloadReportBlob(blob, datedReportFilename('cedants-report', 'xls'));
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {reportParams && <ReportCurrencySummaryCards totals={currencyTotals} isLoading={isLoading} />}

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={data}
          headerClassName="text-[8px]"
          rowClassName="text-[10px]"
          toolbarTrailing={rowsPerPageControl}
          isLoading={reportParams !== null && isLoading}
          exportOptions={
            reportParams && data.length > 0
              ? [
                  { label: 'CSV', onClick: handleExport },
                  { label: 'Excel', onClick: handleExportExcel },
                ]
              : undefined
          }
          onRowClick={(row) =>
            router.push(`/${tenantSlug}/operations/reinsurance/cedants/${row.cedantId}`)
          }
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
              <div className="w-36">
                <MultiSelect
                  size="sm"
                  variant="inline"
                  placeholder="Payments"
                  options={PAYMENT_STATUS_OPTIONS}
                  value={paymentStatuses}
                  onChange={(next) => {
                    setPaymentStatuses(next);
                    setPage(1);
                  }}
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
              ? 'No cedant activity for the selected filters'
              : 'Select a period and click Run Filter to generate the report'
          }
          currentPage={page}
          totalPages={Math.max(1, meta.totalPages)}
          onPageChange={handlePageChange}
          noInternalScroll
        />
      </div>
    </div>
  );
}
