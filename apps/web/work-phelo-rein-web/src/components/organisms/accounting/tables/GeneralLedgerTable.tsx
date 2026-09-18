'use client';

import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { useGeneralLedgerReport } from '@/hooks/accounting/useFinancialReports';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';
import { formatJournalNumber } from '@/lib/formatters';
import { extractError } from '@/lib/extractError';
import type { GeneralLedgerReport } from '@/types/accounting';

const PAGE_SIZE = 25;

type Row = GeneralLedgerReport['lines'][number];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const money = (value: string) =>
  Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const columns: Column<Row>[] = [
  {
    key: 'date',
    label: 'Date',
    width: '90px',
    render: (row) => fmtDate(row.journalDate),
  },
  {
    key: 'journal',
    label: 'Journal',
    width: '140px',
    render: (row) => formatJournalNumber(row.journalNumber),
  },
  {
    key: 'account',
    label: 'Account',
    width: '150px',
    render: (row) => `${row.account.code} — ${row.account.name}`,
  },
  {
    key: 'description',
    label: 'Description',
    width: 'minmax(150px, 1fr)',
    render: (row) => (
      <span title={row.description ?? undefined}>
        {formatSourceEventDescription(row.description)}
      </span>
    ),
  },
  {
    key: 'debit',
    label: 'Debit',
    width: '120px',
    className: 'text-right',
    render: (row) => <span className="block text-right">{money(row.debit)}</span>,
  },
  {
    key: 'credit',
    label: 'Credit',
    width: '120px',
    className: 'text-right',
    render: (row) => <span className="block text-right">{money(row.credit)}</span>,
  },
  {
    key: 'balance',
    label: 'Balance',
    width: '120px',
    className: 'text-right',
    render: (row) => (
      <span className="block text-right font-medium">{money(row.runningBalance)}</span>
    ),
  },
];

export function GeneralLedgerTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useGeneralLedgerReport({}, true);
  const lines = useMemo(() => data?.lines ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return lines;
    const q = search.toLowerCase();
    return lines.filter(
      (line) =>
        line.journalNumber.toLowerCase().includes(q) ||
        (line.description ?? '').toLowerCase().includes(q) ||
        line.account.code.toLowerCase().includes(q) ||
        line.account.name.toLowerCase().includes(q),
    );
  }, [lines, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Unable to load the general ledger: {extractError(error)}
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={paged}
      isLoading={isLoading}
      searchPlaceholder="Search journal, account or description…"
      searchValue={search}
      onSearch={(value) => {
        setSearch(value);
        setPage(1);
      }}
      emptyMessage="No posted ledger activity found"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
