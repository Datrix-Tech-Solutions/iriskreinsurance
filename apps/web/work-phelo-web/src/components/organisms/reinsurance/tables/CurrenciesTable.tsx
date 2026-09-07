'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { AddCurrencyPanel } from '@/components/organisms/reinsurance/panels/AddCurrencyPanel';
import { EditCurrencyPanel } from '@/components/organisms/reinsurance/panels/EditCurrencyPanel';
import { useCurrencies, useDeleteCurrency } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Currency } from '@/types/reinsurance';

const PAGE_SIZE = 10;

export function CurrenciesTable() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Currency | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Currency | null>(null);

  const { data = [], isLoading } = useCurrencies();
  const { mutate: deleteCurrency, isPending: isDeleting } = useDeleteCurrency();

  const columns: Column<Currency>[] = [
    {
      key: 'isoCode',
      label: 'ISO Code',
      width: '150px',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
          {row.isoCode}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Currency',
      width: 'minmax(150px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(160px, auto)',
      render: (row) => (
        <div className="flex items-center gap-3.5" onClick={(e) => e.stopPropagation()}>
          <TableButton variant="blue" onClick={() => setEditTarget(row)}>
            Edit
          </TableButton>
          <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
            Delete
          </TableButton>
        </div>
      ),
    },
  ];

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) => r.name.toLowerCase().includes(q) || r.isoCode.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteCurrency(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Currency deleted successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete currency')),
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search currencies…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Currency', onClick: () => setPanelOpen(true) }}
        emptyMessage="No currencies found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddCurrencyPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <EditCurrencyPanel currency={editTarget} onClose={() => setEditTarget(null)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Currency"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting…"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
