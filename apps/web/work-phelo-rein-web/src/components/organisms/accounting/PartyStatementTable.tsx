'use client';

import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { usePartyStatement } from '@/hooks';
import type { AccountingOpenItem } from '@/types/accounting';

const columns: Column<AccountingOpenItem>[] = [
  {
    key: 'date',
    label: 'Document Date',
    render: (row) => new Date(row.documentDate).toLocaleDateString('en-GB'),
  },
  { key: 'number', label: 'Document', render: (row) => row.documentNumber },
  {
    key: 'due',
    label: 'Due Date',
    render: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString('en-GB') : '—'),
  },
  {
    key: 'total',
    label: 'Original',
    render: (row) => (
      <span className="block text-right">
        {row.currency} {Number(row.totalAmount).toLocaleString()}
      </span>
    ),
  },
  {
    key: 'outstanding',
    label: 'Outstanding',
    render: (row) => (
      <span className="block text-right font-medium">
        {row.currency} {Number(row.outstandingAmount).toLocaleString()}
      </span>
    ),
  },
];

export function PartyStatementTable({
  side,
  partyId,
}: {
  side: 'receivables' | 'payables';
  partyId: string;
}) {
  const { data, isLoading } = usePartyStatement(side, partyId);
  return (
    <DataTable
      columns={columns}
      data={data?.documents ?? []}
      isLoading={isLoading}
      emptyMessage="No open items on this statement."
      currentPage={1}
      totalPages={1}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
