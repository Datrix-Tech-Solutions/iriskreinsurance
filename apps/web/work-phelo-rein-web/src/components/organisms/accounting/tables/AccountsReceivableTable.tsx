'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Modal } from '@/components/organisms/shared/Modal';
import { NewInvoiceForm } from '@/components/organisms/accounting/forms/NewInvoiceForm';
import { AccountingTradeDocument, AccountingTradeDocumentStatus } from '@/types/accounting';
import { useReceivableInvoices } from '@/hooks';
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

export function AccountsReceivableTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState<AccountingTradeDocument | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, isLoading } = useReceivableInvoices({ limit: 100 });
  const invoices = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (r) =>
        r.documentNumber.toLowerCase().includes(q) ||
        r.party.legalName.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [search, invoices]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = useMemo<Column<AccountingTradeDocument>[]>(
    () => [
      {
        key: 'documentNumber',
        label: 'Invoice No.',
        width: '140px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {row.documentNumber}
          </span>
        ),
      },
      {
        key: 'customer',
        label: 'Customer',
        width: 'minmax(150px, 1fr)',
        render: (row) => (
          <span className="text-sm text-gray-800 font-medium">{row.party.legalName}</span>
        ),
      },
      {
        key: 'documentDate',
        label: 'Invoice Date',
        width: '130px',
        render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.documentDate)}</span>,
      },
      {
        key: 'dueDate',
        label: 'Due Date',
        width: '130px',
        render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.dueDate)}</span>,
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
    [],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search invoices…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{
          label: 'New Invoice',
          onClick: () => setPanelOpen(true),
        }}
        onRowClick={(row) => setDetailTarget(row)}
        emptyMessage="No invoices found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <TradeDocumentDetailPanel
        side="RECEIVABLE"
        document={detailTarget}
        onClose={() => setDetailTarget(null)}
      />

      <Modal
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="New Invoice"
        description="Record a new customer invoice."
        width="max-w-5xl"
        height="max-h-[90vh]"
      >
        <NewInvoiceForm
          side="RECEIVABLE"
          onCancel={() => setPanelOpen(false)}
          onCreated={() => setPanelOpen(false)}
        />
      </Modal>
    </>
  );
}
