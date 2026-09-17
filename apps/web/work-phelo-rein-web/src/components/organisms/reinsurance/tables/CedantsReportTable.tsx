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
  useReportPagination,
} from '@/hooks';
import { CedantReportRow, CedantsReportParams } from '@/hooks/reinsurance/useCedantsReport';
import { FACULTATIVE_STATUSES, FacultativeStatus } from '@/types/reinsurance';
import { facultativeStatusLabel } from '@/lib/reinsurance/placementStatus';
import { todayISODate } from '@/lib/reinsurance/reportDates';


const STATUS_OPTIONS = FACULTATIVE_STATUSES.map((s) => ({
  value: s,
  label: facultativeStatusLabel(s),
}));

function fmtAmount(value: number, symbol: string): string {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol} ${formatted}` : formatted;
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
  const [cedantIds, setCedantIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<CedantsReportParams | null>(null);

  const { options: cedantOptions } = useCedantOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const { rows, summary, currencyTotals, isLoading } = useCedantsReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    setReportParams({
      startDate,
      endDate,
      riskTypeIds: riskTypeIds.length ? riskTypeIds : undefined,
      currencies: currencies.length ? currencies : undefined,
      statuses: statuses.length ? (statuses as FacultativeStatus[]) : undefined,
      cedantIds: cedantIds.length ? cedantIds : undefined,
    });
    setPage(1);
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
        render: (row) => fmtAmount(row.totalPremium, summary.currencySymbol),
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        width: '150px',
        render: (row) => fmtAmount(row.outstanding, summary.currencySymbol),
      },
      {
        key: 'pending',
        label: 'Pending',
        width: '150px',
        render: (row) =>
          row.pending > 0.0001 ? (
            <span className="text-amber-600 font-medium">
              {fmtAmount(row.pending, summary.currencySymbol)}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
    ],
    [summary.currencySymbol],
  );

  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.cedantId })), [rows]);
  const { page, setPage, totalPages, pagedRows, rowsPerPageControl } = useReportPagination(data);

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {reportParams && <ReportCurrencySummaryCards totals={currencyTotals} isLoading={isLoading} />}

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={pagedRows}
          toolbarTrailing={rowsPerPageControl}
          isLoading={reportParams !== null && isLoading}
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
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>
    </div>
  );
}
