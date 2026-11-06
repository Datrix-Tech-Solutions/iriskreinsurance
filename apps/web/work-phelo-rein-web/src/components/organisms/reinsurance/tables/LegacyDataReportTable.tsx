'use client';

import { useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import {
  HISTORICAL_STATEMENTS_EXPORT,
  HistoricalStatementFilters,
  HistoricalStatementKind,
  HistoricalStatementListParams,
  HistoricalStatementRow,
  downloadHistoricalStatementsExcel,
  historicalErrorMessage,
  useHistoricalDatasets,
  useHistoricalFacets,
  useHistoricalStatements,
} from '@/hooks/reinsurance/useHistoricalStatements';
import { HistoricalStatementDetailModal } from '@/components/organisms/reinsurance/HistoricalStatementDetailModal';
import { fmtDecimal, fmtSourceDate } from '@/lib/reinsurance/historicalFormat';
import { downloadReportBlob } from '@/lib/reinsurance/downloadReportExport';

const KIND_OPTIONS: { value: HistoricalStatementKind; label: string }[] = [
  { value: 'INSURER', label: 'Insurer statements' },
  { value: 'REINSURER', label: 'Reinsurer statements' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

const toOptions = (values: Array<string | number> | undefined) =>
  (values ?? []).map((v) => ({ value: String(v), label: String(v) }));

/* ── columns ── */

type Row = HistoricalStatementRow;
type ReportColumn = Column<Row>;

const Muted = () => <span className="text-gray-400">—</span>;
const text = (value: string | null | undefined) => value || <Muted />;
const money = (value: string | null | undefined) => (value == null ? <Muted /> : fmtDecimal(value));

const WarningBadge = ({ row }: { row: Row }) =>
  row.qualityWarnings.length ? (
    <span title={row.qualityWarnings.map((w) => w.code).join(', ')}>
      <Badge label={`${row.qualityWarnings.length}`} variant="warning" />
    </span>
  ) : (
    <Muted />
  );

const COMMON_HEAD: ReportColumn[] = [
  { key: 'year', label: 'Year', width: '40px', render: (r) => r.year },
  {
    key: 'policyNumber',
    label: 'Policy Number',
    width: '130px',
    render: (r) => <span className="font-medium text-gray-900">{text(r.policyNumber)}</span>,
  },
];

const COMMON_TAIL: ReportColumn[] = [
  { key: 'insured', label: 'Insured', width: '120px', render: (r) => text(r.insuredName) },
  { key: 'business', label: 'Business Name', width: '110px', render: (r) => text(r.businessName) },
  { key: 'offerDate', label: 'Offer Date', width: '80px', render: (r) => fmtSourceDate(r.offerDate) },
  {
    key: 'closedDate',
    label: 'Date Closed',
    width: '80px',
    render: (r) => fmtSourceDate(r.closedDate),
  },
  { key: 'currency', label: 'Currency', width: '50px', render: (r) => text(r.currency) },
  {
    key: 'facPremium',
    label: 'Fac. Premium',
    width: '100px',
    className: 'text-right',
    render: (r) => money(r.facPremium),
  },
  {
    key: 'paidFacPremium',
    label: 'Paid Fac. Premium',
    width: '110px',
    className: 'text-right',
    render: (r) => money(r.paidFacPremium),
  },
  {
    key: 'brokerage',
    label: 'Brokerage',
    width: '90px',
    className: 'text-right',
    render: (r) => money(r.brokerage),
  },
  {
    key: 'brokeragePaid',
    label: 'Brokerage Paid',
    width: '100px',
    className: 'text-right',
    render: (r) => money(r.brokeragePaid),
  },
  {
    key: 'netDueReinsurer',
    label: 'Net Premium Due Reinsurer',
    width: '130px',
    className: 'text-right',
    render: (r) => money(r.netPremiumDueReinsurer),
  },
  {
    key: 'netPaid',
    label: 'Net Premium Paid',
    width: '110px',
    className: 'text-right',
    render: (r) => money(r.netPremiumPaid),
  },
  { key: 'offerStatus', label: 'Offer Status', width: '80px', render: (r) => text(r.offerStatus) },
  {
    key: 'paymentStatus',
    label: 'Payment Status',
    width: '90px',
    render: (r) => text(r.paymentStatus),
  },
  { key: 'warnings', label: 'Warnings', width: '50px', render: (r) => <WarningBadge row={r} /> },
];

const COLUMNS_BY_KIND: Record<HistoricalStatementKind, ReportColumn[]> = {
  INSURER: [
    ...COMMON_HEAD,
    {
      key: 'insurer',
      label: 'Insurer',
      width: '120px',
      render: (r) => text(r.kind === 'INSURER' ? r.insurerName : null),
    },
    ...COMMON_TAIL,
  ],
  REINSURER: [
    ...COMMON_HEAD,
    {
      key: 'reinsurer',
      label: 'Reinsurer',
      width: '120px',
      render: (r) => text(r.kind === 'REINSURER' ? r.reinsurerName : null),
    },
    {
      key: 'reinsured',
      label: 'Reinsured',
      width: '120px',
      render: (r) => text(r.kind === 'REINSURER' ? r.reinsuredName : null),
    },
    ...COMMON_TAIL,
  ],
};

type StagedFilters = Omit<HistoricalStatementFilters, 'datasetId'>;

export function LegacyDataReportTable() {
  const canExport = usePermissionRule(HISTORICAL_STATEMENTS_EXPORT);

  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [kind, setKind] = useState<HistoricalStatementKind>('INSURER');
  const [filters, setFilters] = useState<StagedFilters>({});
  const [appliedParams, setApplied] = useState<HistoricalStatementListParams | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Row | null>(null);

  const datasetsQuery = useHistoricalDatasets();
  const datasets = useMemo(() => datasetsQuery.data ?? [], [datasetsQuery.data]);
  // Default to the first published dataset and show its rows straight away.
  const datasetId = selectedDatasetId || datasets[0]?.id || '';
  const applied = useMemo<HistoricalStatementListParams | null>(
    () =>
      appliedParams ??
      (datasetId ? { datasetId, kind: 'INSURER', page: 1, limit: pageSize } : null),
    [appliedParams, datasetId, pageSize],
  );
  const { data: facets } = useHistoricalFacets(datasetId || undefined, kind);

  const { rows, meta, isLoading, error } = useHistoricalStatements(applied);

  const setFilter = <K extends keyof StagedFilters>(key: K, value: StagedFilters[K] | '') =>
    setFilters((prev) => ({ ...prev, [key]: value === '' ? undefined : value }));

  const handleDatasetChange = (id: string) => {
    setSelectedDatasetId(id);
    setFilters({});
    setApplied({ datasetId: id, kind, page: 1, limit: pageSize });
  };

  const handleRunFilter = () => {
    if (!datasetId) return;
    setApplied({ ...filters, datasetId, kind, page: 1, limit: pageSize });
  };

  const handleExport = async () => {
    if (!applied) return;
    const { kind: appliedKind, page: _page, limit: _limit, ...exportFilters } = applied;
    void _page;
    void _limit;
    const blob = await downloadHistoricalStatementsExcel(appliedKind, exportFilters);
    downloadReportBlob(
      blob,
      `historical-${appliedKind === 'INSURER' ? 'insurer' : 'reinsurer'}-statements-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`,
    );
  };

  const errorMessage =
    historicalErrorMessage(datasetsQuery.error) ?? historicalErrorMessage(error);

  const emptyMessage = errorMessage
    ? errorMessage
    : datasetsQuery.isSuccess && datasets.length === 0
      ? 'No historical statement datasets have been published yet'
      : 'No historical statements match the selected filters';

  const rowsPerPageControl =
    applied && meta.total > 10 ? (
      <label className="flex items-center gap-1.5 text-sm text-gray-500">
        Rows
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const next = Number(e.target.value);
            setPageSize(next);
            setApplied(applied ? { ...applied, page: 1, limit: next } : null);
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

  const textInput = (key: 'policyNumber' | 'search', placeholder: string) => (
    <input
      type="text"
      maxLength={512}
      value={filters[key] ?? ''}
      placeholder={placeholder}
      onChange={(e) => setFilter(key, e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && handleRunFilter()}
      className="w-full rounded-input border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-(--focus-ring,var(--color-gray-400))"
    />
  );

  const facetSelect = (
    key: keyof StagedFilters,
    placeholder: string,
    values: Array<string | number> | undefined,
    width = 'w-40',
  ) => (
    <div className={width}>
      <SearchSelect
        size="sm"
        placeholder={placeholder}
        options={toOptions(values)}
        value={String(filters[key] ?? '')}
        onChange={(v) => setFilter(key, (key === 'year' && v ? Number(v) : v) as never)}
      />
    </div>
  );

  const appliedKind = applied?.kind ?? kind;

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex-1 min-h-0">
        <DataTable
          columns={COLUMNS_BY_KIND[appliedKind]}
          data={rows}
          headerClassName="text-[8px]"
          rowClassName="text-[10px]"
          isLoading={applied !== null && isLoading}
          onRowClick={(row) => setSelected(row)}
          exportOptions={
            canExport && applied && rows.length > 0
              ? [{ label: 'Excel', onClick: handleExport }]
              : undefined
          }
          toolbarTrailing={rowsPerPageControl}
          extraFilters={
            <div className="flex w-full items-center gap-2 flex-wrap">
              <div className="w-52">
                <SearchSelect
                  size="sm"
                  disableClear
                  placeholder="Dataset"
                  options={datasets.map((d) => ({
                    value: d.id,
                    label: `${d.datasetKey.slice(0, 8)} · ${d.datasetVersion}`,
                  }))}
                  value={datasetId}
                  onChange={handleDatasetChange}
                />
              </div>
              <div className="w-48">
                <SearchSelect
                  size="sm"
                  disableClear
                  placeholder="Statement type"
                  options={KIND_OPTIONS}
                  value={kind}
                  onChange={(v) => setKind(v as HistoricalStatementKind)}
                />
              </div>
              {facetSelect('year', 'Year', facets?.years, 'w-28')}
              <div className="w-40">{textInput('policyNumber', 'Policy number')}</div>
              <div className="w-40">{textInput('search', 'Search')}</div>
              {facetSelect('insurer', kind === 'INSURER' ? 'Insurer' : 'Reinsured', facets?.insurers)}
              {facetSelect('reinsurer', 'Reinsurer', facets?.reinsurers)}
              {facetSelect('insured', 'Insured', facets?.insureds)}
              {facetSelect('businessName', 'Business name', facets?.businessNames)}
              {facetSelect('currency', 'Currency', facets?.currencies, 'w-32')}
              {facetSelect('offerStatus', 'Offer status', facets?.offerStatuses, 'w-36')}
              {facetSelect('paymentStatus', 'Payment status', facets?.paymentStatuses, 'w-36')}
              <div className="w-44">
                <DatePicker
                  size="sm"
                  placeholder="Offer date from"
                  value={filters.offerDateFrom ?? ''}
                  onChange={(v) => setFilter('offerDateFrom', v)}
                />
              </div>
              <div className="w-44">
                <DatePicker
                  size="sm"
                  placeholder="Offer date to"
                  value={filters.offerDateTo ?? ''}
                  minDate={filters.offerDateFrom || undefined}
                  onChange={(v) => setFilter('offerDateTo', v)}
                />
              </div>
              <div className="w-44">
                <DatePicker
                  size="sm"
                  placeholder="Closed from"
                  value={filters.closedDateFrom ?? ''}
                  onChange={(v) => setFilter('closedDateFrom', v)}
                />
              </div>
              <div className="w-44">
                <DatePicker
                  size="sm"
                  placeholder="Closed to"
                  value={filters.closedDateTo ?? ''}
                  minDate={filters.closedDateFrom || undefined}
                  onChange={(v) => setFilter('closedDateTo', v)}
                />
              </div>
            </div>
          }
          actionButton={{
            label: 'Run Filter',
            onClick: handleRunFilter,
            disabled: !datasetId,
          }}
          emptyMessage={emptyMessage}
          currentPage={applied?.page ?? 1}
          totalPages={meta.totalPages}
          onPageChange={(page) => setApplied(applied ? { ...applied, page } : null)}
          noInternalScroll
        />
      </div>

      <HistoricalStatementDetailModal
        row={selected}
        datasetId={applied?.datasetId ?? datasetId}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
