'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { AccountTransaction } from '@/types/accounting';

const PAGE_SIZE = 10;

// TODO: replace with useAccountTransactions(accountId) hook once API is ready
const MOCK_DATA: AccountTransaction[] = [];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(amount: number | null, currency: string) {
  if (amount === null) return '—';
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COLUMNS: Column<AccountTransaction>[] = [
  {
    key: 'date',
    label: 'Date',
    width: '130px',
    render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.date)}</span>,
  },
  {
    key: 'reference',
    label: 'Reference',
    width: '140px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.reference}
      </span>
    ),
  },
  {
    key: 'description',
    label: 'Description',
    width: 'minmax(150px, 1fr)',
    render: (row) => <span className="text-sm text-gray-800">{row.description}</span>,
  },
  {
    key: 'type',
    label: 'Type',
    width: '90px',
    render: (row) => (
      <Badge label={row.type} variant={row.type === 'Credit' ? 'success' : 'danger'} />
    ),
  },
  {
    key: 'debit',
    label: 'Debit',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-sm text-red-600 font-medium">
        {fmtAmount(row.debit, row.currency)}
      </span>
    ),
  },
  {
    key: 'credit',
    label: 'Credit',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-sm text-green-600 font-medium">
        {fmtAmount(row.credit, row.currency)}
      </span>
    ),
  },
  {
    key: 'balance',
    label: 'Balance',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-sm font-semibold text-gray-900">
        {fmtAmount(row.balance, row.currency)}
      </span>
    ),
  },
];

export function AccountTransactionsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return MOCK_DATA;
    const q = search.toLowerCase();
    return MOCK_DATA.filter(
      (r) => r.description.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q),
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DataTable
      columns={COLUMNS}
      data={paged}
      isLoading={false}
      searchPlaceholder="Search transactions…"
      searchValue={search}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      emptyMessage="No transactions found"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
