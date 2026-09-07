'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { BudgetForecast } from '@/types/accounting';

const PAGE_SIZE = 10;

// TODO: replace with useBudgetForecasts() hook once API is ready
const MOCK_DATA: BudgetForecast[] = [];

const FISCAL_YEARS = ['2022', '2023', '2024', '2025', '2026'];

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COLUMNS: Column<BudgetForecast>[] = [
  {
    key: 'budgetName',
    label: 'Budget Name',
    width: 'minmax(100px, 0.5fr)',
    render: (row) => <span className="font-medium text-gray-900">{row.budgetName}</span>,
  },
  {
    key: 'department',
    label: 'Department',
    width: 'minmax(150px, 1fr)',
    render: (row) => <span className="text-sm text-gray-700">{row.department}</span>,
  },
  {
    key: 'fiscalYear',
    label: 'Fiscal Year',
    width: '100px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.fiscalYear}
      </span>
    ),
  },
  {
    key: 'version',
    label: 'Version',
    width: '100px',
    render: (row) => <span className="text-sm text-gray-600">{row.version}</span>,
  },
  {
    key: 'amount',
    label: 'Amount',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-sm font-medium text-gray-900">
        {fmtAmount(row.amount, row.currency)}
      </span>
    ),
  },
  {
    key: 'actualSpend',
    label: 'Actual Spend',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-sm text-gray-700">
        {fmtAmount(row.actualSpend, row.currency)}
      </span>
    ),
  },
  {
    key: 'variance',
    label: 'Variance',
    width: '150px',
    render: (row) => {
      const variance = row.amount - row.actualSpend;
      return (
        <span
          className={`block text-right text-sm font-medium ${
            variance >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {variance >= 0 ? '+' : ''}
          {fmtAmount(variance, row.currency)}
        </span>
      );
    },
  },
];

export function BudgetForecastTable() {
  const [search, setSearch] = useState('');
  const [fiscalYearFilter, setFiscalYearFilter] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = MOCK_DATA;
    if (fiscalYearFilter) rows = rows.filter((r) => r.fiscalYear === fiscalYearFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.budgetName.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.version.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [search, fiscalYearFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DataTable
      columns={COLUMNS}
      data={paged}
      isLoading={false}
      searchPlaceholder="Search budgets…"
      searchValue={search}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      filterOptions={FISCAL_YEARS.map((y) => ({ value: y, label: y }))}
      onFilter={(v) => {
        setFiscalYearFilter(v);
        setPage(1);
      }}
      actionButton={{
        label: 'Add Budget',
        onClick: () => {
          // TODO: open AddBudgetPanel once built
        },
      }}
      rowActions={() => [
        { label: 'Edit', onClick: () => {} },
        { label: 'Delete', onClick: () => {}, danger: true },
      ]}
      emptyMessage="No budgets found"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
    />
  );
}
