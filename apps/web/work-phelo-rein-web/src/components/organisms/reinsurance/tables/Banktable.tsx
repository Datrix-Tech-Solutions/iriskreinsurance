'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AddBankPanel } from '@/components/organisms/reinsurance/panels/AddBankPanel';
import { Bank, BankFormValues } from '@/types/reinsurance';

const PAGE_SIZE = 10;

const COLUMNS: Column<Bank>[] = [
  {
    key: 'bankName',
    label: 'Bank Name',
    width: '2fr',
    render: (row) => <span className="text-gray-700">{row.bankName}</span>,
  },
  {
    key: 'accountName',
    label: 'Account Name',
    width: '2fr',
    render: (row) => <span className="font-medium text-gray-900">{row.accountName}</span>,
  },
  {
    key: 'accountNumber',
    label: 'Account Number',
    width: '2fr',
    render: (row) => <span className="text-gray-700">{row.accountNumber}</span>,
  },

  {
    key: 'branchName',
    label: 'Branch Name',
    width: '2fr',
    render: (row) => <span className="text-gray-700">{row.branchName}</span>,
  },
];

export function BanksTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);

  const filtered = useMemo(() => {
    if (!search) return banks;
    const q = search.toLowerCase();
    return banks.filter(
      (r) =>
        r.accountName.toLowerCase().includes(q) ||
        r.accountNumber.toLowerCase().includes(q) ||
        r.bankName.toLowerCase().includes(q) ||
        r.branchName.toLowerCase().includes(q),
    );
  }, [banks, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAdd = (data: BankFormValues) => {
    const newBank: Bank = {
      id: crypto.randomUUID(),
      tenantId: '',
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setBanks((prev) => [newBank, ...prev]);
    setPanelOpen(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setBanks((prev) => prev.filter((b) => b.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={false}
        searchPlaceholder="Search banks…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Bank', onClick: () => setPanelOpen(true) }}
        rowActions={(row) => [
          {
            label: 'Edit',
            onClick: () => {},
          },
          {
            label: 'Archive',
            onClick: () => setDeleteTarget(row),
            danger: true,
          },
        ]}
        emptyMessage="No banks found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddBankPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} onAdd={handleAdd} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Bank"
        description={`Are you sure you want to delete "${deleteTarget?.accountName}"? This action cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
