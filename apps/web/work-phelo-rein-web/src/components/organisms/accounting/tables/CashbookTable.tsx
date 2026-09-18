'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { CashbookTransaction, CashbookTransactionStatus } from '@/types/accounting';
import { useCashAccountOptions, useCashbookTransactions } from '@/hooks';
import { CashbookEntryPanel } from '@/components/organisms/accounting/panels/CashbookEntryPanel';
import { CashbookTransferPanel } from '@/components/organisms/accounting/panels/CashbookTransferPanel';
import { CashbookTransactionDetailPanel } from '@/components/organisms/accounting/panels/CashbookTransactionDetailPanel';

const PAGE_SIZE = 10;

const TYPE_LABEL: Record<CashbookTransaction['transactionType'], string> = {
  RECEIPT: 'Receipt',
  PAYMENT: 'Payment',
  TRANSFER: 'Transfer',
  CHARGE: 'Bank Charge',
  ADJUSTMENT: 'Adjustment',
};

const STATUS_VARIANT: Record<CashbookTransactionStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
};

const TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'CHARGE', label: 'Bank Charge' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
];

const STATUS_OPTIONS: SearchSelectOption[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'REVERSED', label: 'Reversed' },
];

type NewTransactionChoice = 'RECEIPT' | 'PAYMENT' | 'CHARGE' | 'ADJUSTMENT' | 'TRANSFER';

function fmtAmount(amount: string, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`;
}

export function CashbookTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [cashAccountId, setCashAccountId] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [status, setStatus] = useState('');
  const [newTransactionOpen, setNewTransactionOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<NewTransactionChoice | null>(null);
  const [detailTarget, setDetailTarget] = useState<CashbookTransaction | null>(null);

  const { options: cashAccountOptions } = useCashAccountOptions();

  const { data, isLoading } = useCashbookTransactions({
    cashAccountId: cashAccountId || undefined,
    transactionType: (transactionType || undefined) as
      | CashbookTransaction['transactionType']
      | undefined,
    status: (status || undefined) as CashbookTransactionStatus | undefined,
    limit: 100,
  });

  const transactions = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        (r.reference ?? '').toLowerCase().includes(q) ||
        r.cashAccount.name.toLowerCase().includes(q),
    );
  }, [search, transactions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = useMemo<Column<CashbookTransaction>[]>(
    () => [
      {
        key: 'transactionDate',
        label: 'Date',
        width: '110px',
        render: (row) => (
          <span className="text-gray-600 text-sm">
            {new Date(row.transactionDate).toLocaleDateString()}
          </span>
        ),
      },
      {
        key: 'transactionType',
        label: 'Type',
        width: '110px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {TYPE_LABEL[row.transactionType]}
          </span>
        ),
      },
      {
        key: 'cashAccount',
        label: 'Cash/Bank Account',
        width: 'minmax(160px, 1fr)',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{row.cashAccount.name}</span>
            {row.destinationCashAccount && (
              <span className="text-xs text-gray-400">→ {row.destinationCashAccount.name}</span>
            )}
          </div>
        ),
      },
      {
        key: 'description',
        label: 'Description',
        width: 'minmax(180px, 1.4fr)',
        render: (row) => <span className="text-gray-700 text-sm">{row.description}</span>,
      },
      {
        key: 'amount',
        label: 'Amount',
        width: '150px',
        className: 'text-right pr-6',
        render: (row) => (
          <span className="text-gray-900 font-medium block text-right">
            {fmtAmount(row.amount, row.currency)}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '100px',
        render: (row) => <Badge label={row.status} variant={STATUS_VARIANT[row.status]} />,
      },
    ],
    [],
  );

  const extraFilters = (
    <>
      <div>
        <SearchSelect
          size="sm"
          placeholder="Cash/Bank Account"
          options={cashAccountOptions}
          value={cashAccountId}
          onChange={(v) => {
            setCashAccountId(v);
            setPage(1);
          }}
        />
      </div>
      <div>
        <SearchSelect
          size="sm"
          placeholder="Type"
          options={TYPE_OPTIONS}
          value={transactionType}
          onChange={(v) => {
            setTransactionType(v);
            setPage(1);
          }}
        />
      </div>
      <div>
        <SearchSelect
          size="sm"
          placeholder="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>
    </>
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search description, reference or account…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={extraFilters}
        actionButton={{ label: 'New Transaction', onClick: () => setNewTransactionOpen(true) }}
        onRowClick={(row) => setDetailTarget(row)}
        emptyMessage="No cashbook transactions found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Modal
        isOpen={newTransactionOpen}
        onClose={() => setNewTransactionOpen(false)}
        title="New Cashbook Transaction"
        description="Choose the type of transaction to record."
      >
        <div className="grid grid-cols-1 gap-2">
          {(
            [
              { key: 'RECEIPT', label: 'Receipt', hint: 'Money received into a cash/bank account' },
              { key: 'PAYMENT', label: 'Payment', hint: 'Money paid out of a cash/bank account' },
              {
                key: 'TRANSFER',
                label: 'Transfer',
                hint: 'Move funds between two cash/bank accounts',
              },
              {
                key: 'CHARGE',
                label: 'Bank Charge',
                hint: 'A bank fee against a cash/bank account',
              },
              {
                key: 'ADJUSTMENT',
                label: 'Adjustment',
                hint: 'Manual correction to a cash/bank account',
              },
            ] as { key: NewTransactionChoice; label: string; hint: string }[]
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setNewTransactionOpen(false);
                setActivePanel(option.key);
              }}
              className="flex flex-col items-start gap-0.5 rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:border-orange-500 hover:bg-orange-50"
            >
              <span className="text-sm font-semibold text-gray-900">{option.label}</span>
              <span className="text-xs text-gray-500">{option.hint}</span>
            </button>
          ))}
        </div>
      </Modal>

      <CashbookEntryPanel
        isOpen={!!activePanel && activePanel !== 'TRANSFER'}
        onClose={() => setActivePanel(null)}
        transactionType={activePanel && activePanel !== 'TRANSFER' ? activePanel : 'RECEIPT'}
      />

      <CashbookTransferPanel
        isOpen={activePanel === 'TRANSFER'}
        onClose={() => setActivePanel(null)}
      />

      <CashbookTransactionDetailPanel
        transaction={detailTarget}
        onClose={() => setDetailTarget(null)}
      />
    </>
  );
}
