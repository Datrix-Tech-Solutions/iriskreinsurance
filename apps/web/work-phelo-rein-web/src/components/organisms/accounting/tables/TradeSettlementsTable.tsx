'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import {
  AccountingTradeDocumentStatus,
  AccountingTradeSettlement,
  AccountingTradeSide,
} from '@/types/accounting';
import { usePayablePayments, useReceivableReceipts } from '@/hooks';
import { AddTradeSettlementPanel } from '@/components/organisms/accounting/panels/AddTradeSettlementPanel';
import { TradeSettlementDetailPanel } from '@/components/organisms/accounting/panels/TradeSettlementDetailPanel';

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

interface TradeSettlementsTableProps {
  side: AccountingTradeSide;
}

export function TradeSettlementsTable({ side }: TradeSettlementsTableProps) {
  const isReceivable = side === 'RECEIVABLE';
  const documentLabel = isReceivable ? 'Receipt' : 'Payment';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<AccountingTradeSettlement | null>(null);

  const receivableQuery = useReceivableReceipts(isReceivable ? { limit: 100 } : { limit: 1 });
  const payableQuery = usePayablePayments(!isReceivable ? { limit: 100 } : { limit: 1 });
  const { data, isLoading } = isReceivable ? receivableQuery : payableQuery;
  const settlements = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return settlements;
    const q = search.toLowerCase();
    return settlements.filter(
      (r) =>
        r.settlementNumber.toLowerCase().includes(q) ||
        r.party.legalName.toLowerCase().includes(q) ||
        (r.reference ?? '').toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [search, settlements]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = useMemo<Column<AccountingTradeSettlement>[]>(
    () => [
      {
        key: 'settlementNumber',
        label: `${documentLabel} No.`,
        width: '150px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {row.settlementNumber}
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
        key: 'settlementDate',
        label: 'Date',
        width: '130px',
        render: (row) => (
          <span className="text-sm text-gray-700">{fmtDate(row.settlementDate)}</span>
        ),
      },
      {
        key: 'reference',
        label: 'Reference',
        width: '150px',
        render: (row) => <span className="text-sm text-gray-700">{row.reference ?? '—'}</span>,
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
        key: 'status',
        label: 'Status',
        width: '120px',
        render: (row) => <Badge label={row.status} variant={STATUS_VARIANT[row.status]} />,
      },
    ],
    [isReceivable, documentLabel],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder={`Search ${documentLabel.toLowerCase()}s…`}
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: `New ${documentLabel}`, onClick: () => setAddPanelOpen(true) }}
        onRowClick={(row) => setDetailTarget(row)}
        emptyMessage={`No ${documentLabel.toLowerCase()}s found`}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <AddTradeSettlementPanel
        isOpen={addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        side={side}
      />

      <TradeSettlementDetailPanel
        side={side}
        settlement={detailTarget}
        onClose={() => setDetailTarget(null)}
      />
    </>
  );
}
