'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { AccountingCashAccount, AccountingCashAccountKind } from '@/types/accounting';
import { useCashAccounts, useUpdateCashAccount } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { AddCashAccountPanel } from '@/components/organisms/accounting/panels/AddCashAccountPanel';
import { EditCashAccountPanel } from '@/components/organisms/accounting/panels/EditCashAccountPanel';

const PAGE_SIZE = 10;

const KIND_LABEL: Record<AccountingCashAccountKind, string> = {
  BANK: 'Bank',
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
  OTHER: 'Other',
};

export function CashAccountsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deactivateTarget, setDeactivateTarget] = useState<AccountingCashAccount | null>(null);
  const [editTarget, setEditTarget] = useState<AccountingCashAccount | null>(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const { data = [], isLoading } = useCashAccounts();
  const updateCashAccount = useUpdateCashAccount();
  const addToast = useToastStore((s) => s.addToast);

  const columns = useMemo<Column<AccountingCashAccount>[]>(
    () => [
      {
        key: 'name',
        label: 'Account Name',
        width: 'minmax(180px, 1fr)',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{row.name}</span>
            {row.bankName && <span className="text-xs text-gray-400">{row.bankName}</span>}
          </div>
        ),
      },
      {
        key: 'accountKind',
        label: 'Type',
        width: '130px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {KIND_LABEL[row.accountKind]}
          </span>
        ),
      },
      {
        key: 'currency',
        label: 'Currency',
        width: '100px',
        render: (row) => <span className="text-gray-700 text-sm">{row.currency}</span>,
      },
      {
        key: 'accountNumber',
        label: 'Account No.',
        width: '150px',
        render: (row) => <span className="text-gray-600 text-sm">{row.accountNumber ?? '—'}</span>,
      },
      {
        key: 'glAccount',
        label: 'GL Account',
        width: 'minmax(160px, 1fr)',
        render: (row) => (
          <span className="text-gray-700 text-sm">
            {row.glAccount ? `${row.glAccount.code} – ${row.glAccount.name}` : '—'}
          </span>
        ),
      },
      {
        key: 'isActive',
        label: 'Status',
        width: '100px',
        render: (row) => (
          <Badge
            label={row.isActive ? 'Active' : 'Inactive'}
            variant={row.isActive ? 'success' : 'neutral'}
          />
        ),
      },
    ],
    [],
  );

  function deactivate(account: AccountingCashAccount) {
    updateCashAccount.mutate(
      { id: account.id, isActive: false },
      {
        onSuccess: () => setDeactivateTarget(null),
        onError: (error) => addToast({ message: extractError(error), type: 'error' }),
      },
    );
  }

  function reactivate(account: AccountingCashAccount) {
    updateCashAccount.mutate(
      { id: account.id, isActive: true },
      { onError: (error) => addToast({ message: extractError(error), type: 'error' }) },
    );
  }

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.bankName ?? '').toLowerCase().includes(q) ||
        (r.accountNumber ?? '').toLowerCase().includes(q) ||
        r.currency.toLowerCase().includes(q),
    );
  }, [search, data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search cash/bank accounts…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{
          label: 'Add Cash/Bank Account',
          onClick: () => setAddPanelOpen(true),
        }}
        rowActions={(row) => [
          { label: 'Update', onClick: () => setEditTarget(row) },
          {
            label: row.isActive ? 'Deactivate' : 'Reactivate',
            onClick: () => (row.isActive ? setDeactivateTarget(row) : reactivate(row)),
            danger: row.isActive,
          },
        ]}
        emptyMessage="No cash or bank accounts found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Modal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate Cash/Bank Account"
        description={`Are you sure you want to deactivate "${deactivateTarget?.name}"? It will no longer be selectable for new financial confirmations or cashbook transactions.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={updateCashAccount.isPending}
              onClick={() => deactivateTarget && deactivate(deactivateTarget)}
            >
              Deactivate
            </Button>
          </div>
        }
      />

      <AddCashAccountPanel isOpen={addPanelOpen} onClose={() => setAddPanelOpen(false)} />

      <EditCashAccountPanel account={editTarget} onClose={() => setEditTarget(null)} />
    </>
  );
}
