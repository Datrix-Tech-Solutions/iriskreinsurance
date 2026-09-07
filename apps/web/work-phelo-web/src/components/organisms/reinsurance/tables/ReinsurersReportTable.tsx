'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { ReportCurrencySummaryCards } from '@/components/molecules/reinsurance/reports/ReportCurrencySummaryCards';
import {
  useReinsurerOptions,
  useRiskTypeOptions,
  useCurrencyOptions,
  useReinsurersReport,
} from '@/hooks';
import {
  ReinsurerReportRow,
  ReinsurersReportParams,
} from '@/hooks/reinsurance/useReinsurersReport';
import { FACULTATIVE_STATUSES, FacultativeStatus } from '@/types/reinsurance';
import { facultativeStatusLabel } from '@/lib/reinsurance/placementStatus';

const PAGE_SIZE = 10;

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

export function ReinsurersReportTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [page, setPage] = useState(1);

  // Staged filter values — only applied to the report once "Run Filter" is clicked.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [riskTypeId, setRiskTypeId] = useState('');
  const [currency, setCurrency] = useState('');
  const [status, setStatus] = useState('');
  const [reinsurerIds, setReinsurerIds] = useState<string[]>([]);
  const [reportParams, setReportParams] = useState<ReinsurersReportParams | null>(null);

  const { options: reinsurerOptions } = useReinsurerOptions();
  const { data: riskTypeOptions = [] } = useRiskTypeOptions();
  const { data: currencyOptions = [] } = useCurrencyOptions();

  const { rows, summary, currencyTotals, isLoading } = useReinsurersReport(reportParams ?? {}, {
    enabled: reportParams !== null,
  });

  const handleRunFilter = () => {
    setReportParams({
      startDate,
      endDate,
      riskTypeId: riskTypeId || undefined,
      currency: currency || undefined,
      status: (status || undefined) as FacultativeStatus | undefined,
      reinsurerIds: reinsurerIds.length ? reinsurerIds : undefined,
    });
    setPage(1);
  };

  const columns: Column<ReinsurerReportRow & { id: string }>[] = useMemo(
    () => [
      { key: 'name', label: 'Reinsurer', width: 'minmax(150px, 1fr)' },
      {
        key: 'placementCount',
        label: 'Placements',
        width: '110px',
        render: (row) => row.placementCount.toLocaleString(),
      },
      {
        key: 'cededPremium',
        label: 'Ceded Premium',
        width: '150px',
        render: (row) => fmtAmount(row.cededPremium, summary.currencySymbol),
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

  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.reinsurerId })), [rows]);
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {reportParams && <ReportCurrencySummaryCards totals={currencyTotals} isLoading={isLoading} />}

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={paged}
          isLoading={reportParams !== null && isLoading}
          onRowClick={(row) =>
            router.push(`/${tenantSlug}/operations/reinsurance/reinsurers/${row.reinsurerId}`)
          }
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
              <div className="w-36">
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Risk type"
                  options={riskTypeOptions}
                  value={riskTypeId}
                  onChange={setRiskTypeId}
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
                <SearchSelect
                  size="sm"
                  showAllOption
                  placeholder="Status"
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={setStatus}
                />
              </div>
              <div className="w-44">
                <MultiSelect
                  size="sm"
                  variant="inline"
                  placeholder="Reinsurers"
                  options={reinsurerOptions}
                  value={reinsurerIds}
                  onChange={setReinsurerIds}
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
              ? 'No reinsurer activity for the selected filters'
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
