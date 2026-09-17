'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { CostCentrePanel } from '@/components/organisms/accounting/panels/CostCentrePanel';
import { useCostCentres, useDeactivateCostCentre } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { CostCentre } from '@/types/accounting';

const PAGE_SIZE = 10;
export function CostCentresTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelTarget, setPanelTarget] = useState<CostCentre | null | undefined>(undefined);
  const [deactivateTarget, setDeactivateTarget] = useState<CostCentre | null>(null);
  const { data = [], isLoading } = useCostCentres();
  const deactivate = useDeactivateCostCentre();
  const toast = useToast();
  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return !query
      ? data
      : data.filter(
          (item) =>
            item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query),
        );
  }, [data, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const columns: Column<CostCentre>[] = [
    {
      key: 'code',
      label: 'Code',
      width: '130px',
      render: (row) => <span className="font-medium text-gray-900">{row.code}</span>,
    },
    { key: 'name', label: 'Name', width: 'minmax(180px, 1fr)', render: (row) => row.name },
    {
      key: 'externalRef',
      label: 'External Reference',
      width: '180px',
      render: (row) => row.externalRef ?? '—',
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      render: (row) => (
        <Badge
          label={row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
          variant={row.status === 'ACTIVE' ? 'success' : 'neutral'}
        />
      ),
    },
  ];
  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    deactivate.mutate(deactivateTarget.id, {
      onSuccess: () => setDeactivateTarget(null),
      onError: (error) => toast.error(extractError(error, 'Unable to deactivate cost centre')),
    });
  };
  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search cost centres…"
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        actionButton={{ label: 'Add Cost Centre', onClick: () => setPanelTarget(null) }}
        rowActions={(row) => [
          { label: 'Update', onClick: () => setPanelTarget(row) },
          ...(row.status === 'ACTIVE'
            ? [{ label: 'Deactivate', danger: true, onClick: () => setDeactivateTarget(row) }]
            : []),
        ]}
        emptyMessage="No cost centres found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
      <CostCentrePanel costCentre={panelTarget} onClose={() => setPanelTarget(undefined)} />
      <Modal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate Cost Centre"
        description={`Are you sure you want to deactivate "${deactivateTarget?.name}"? It will no longer be available for new journal lines.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={deactivate.isPending} onClick={confirmDeactivate}>
              Deactivate
            </Button>
          </div>
        }
      />
    </>
  );
}
