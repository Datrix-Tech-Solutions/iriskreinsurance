'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AddBrokerPanel } from '@/components/organisms/reinsurance/panels/AddBrokerPanel';
import { AddContactPanel } from '@/components/organisms/reinsurance/panels/AddContactPanel';
import { useBrokers, useDeleteBroker } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Counterparty } from '@/types/reinsurance';
import { codeToCountry } from '@/lib/geo';

const PAGE_SIZE = 10;

function formatTerritory(addresses: Counterparty['addresses']): string {
  const primary = addresses.find((a) => a.isPrimary) ?? addresses[0];
  if (!primary) return '—';
  const country = codeToCountry(primary.country);
  return primary.state ? `${primary.state}, ${country}` : country;
}

const COLUMNS: Column<Counterparty>[] = [
  {
    key: 'name',
    label: 'Broker Name',
    width: '2fr',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    width: '2fr',
    render: (row) => <span className="text-gray-700">{row.email ?? '—'}</span>,
  },
  {
    key: 'phone',
    label: 'Phone Number',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{row.phone ?? '—'}</span>,
  },
  {
    key: 'addresses',
    label: 'Territory',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{formatTerritory(row.addresses)}</span>,
  },
];

export function BrokersTable() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Counterparty | null>(null);
  const [contactTarget, setContactTarget] = useState<Counterparty | null>(null);

  const { data = [], isLoading } = useBrokers();
  const { mutate: deleteBroker, isPending: isDeleting } = useDeleteBroker();

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteBroker(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Broker archived successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to archive broker')),
    });
  };

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search brokers…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Broker', onClick: () => setPanelOpen(true) }}
        rowActions={(row) => [
          {
            label: 'Edit',
            onClick: () => {
              /* TODO: open edit panel */
            },
          },
          {
            label: 'Add Contact',
            onClick: () => setContactTarget(row),
          },
          {
            label: 'Archive',
            onClick: () => setDeleteTarget(row),
            danger: true,
          },
        ]}
        emptyMessage="No brokers found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddBrokerPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <AddContactPanel counterparty={contactTarget} onClose={() => setContactTarget(null)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Archive Broker"
        description={`Are you sure you want to archive "${deleteTarget?.name}"? It will no longer appear in lists.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Archiving…"
              onClick={handleDelete}
            >
              Archive
            </Button>
          </div>
        }
      />
    </>
  );
}
