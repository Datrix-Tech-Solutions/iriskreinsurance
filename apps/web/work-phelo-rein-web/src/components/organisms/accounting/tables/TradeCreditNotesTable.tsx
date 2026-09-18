'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import {
  AccountingTradeDocument,
  AccountingTradeDocumentStatus,
  AccountingTradeSide,
} from '@/types/accounting';
import { usePayableCreditNotes, useReceivableCreditNotes } from '@/hooks';
import { AddTradeCreditNotePanel } from '@/components/organisms/accounting/panels/AddTradeCreditNotePanel';
import { TradeDocumentDetailPanel } from '@/components/organisms/accounting/panels/TradeDocumentDetailPanel';

const PAGE_SIZE = 10;

const STATUS_VARIANT: Record<AccountingTradeDocumentStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(amount: string, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`;
}

interface TradeCreditNotesTableProps {
  side: AccountingTradeSide;
}

export function TradeCreditNotesTable({ side }: TradeCreditNotesTableProps) {
  const isReceivable = side === 'RECEIVABLE';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<AccountingTradeDocument | null>(null);

  const receivableQuery = useReceivableCreditNotes(isReceivable ? { limit: 100 } : { limit: 1 });
  const payableQuery = usePayableCreditNotes(!isReceivable ? { limit: 100 } : { limit: 1 });
  const { data, isLoading } = isReceivable ? receivableQuery : payableQuery;
  const creditNotes = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return creditNotes;
    const q = search.toLowerCase();
    return creditNotes.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        r.party.legalName.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [search, creditNotes]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = useMemo<Column<AccountingTradeDocument>[]>(
    () => [
      {
        key: 'documentNumber',
        label: 'Credit Note No.',
        width: '150px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {row.documentNumber}
          </span>
        ),
      },
      {
        key: 'party',
        label: isReceivable ? 'Customer' : 'Vendor',
        width: 'minmax(150px, 1fr)',
        render: (row) => (
          <span className="text-sm text-gray-800 font-medium">{row.party.legalName}</span>
        ),
      },
      {
        key: 'documentDate',
        label: 'Date',
        width: '130px',
        render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.documentDate)}</span>,
      },
      {
        key: 'appliedTo',
        label: 'Applied To',
        width: '150px',
        render: (row) => (
          <span className="text-sm text-gray-700">
            {row.originalDocument?.documentNumber ?? 'Unapplied'}
          </span>
        ),
      },
      {
        key: 'amount',
        label: 'Amount',
        width: '150px',
        render: (row) => (
          <span className="block text-right text-sm font-medium text-gray-900">
            {fmtAmount(row.totalAmount, row.currency)}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '120px',
        render: (row) => <Badge label={row.status} variant={STATUS_VARIANT[row.status]} />,
      },
    ],
    [isReceivable],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search credit notes…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'New Credit Note', onClick: () => setAddPanelOpen(true) }}
        onRowClick={(row) => setDetailTarget(row)}
        emptyMessage="No credit notes found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <AddTradeCreditNotePanel
        isOpen={addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        side={side}
      />

      <TradeDocumentDetailPanel
        side={side}
        document={detailTarget}
        onClose={() => setDetailTarget(null)}
        documentKind="creditNote"
      />
    </>
  );
}
