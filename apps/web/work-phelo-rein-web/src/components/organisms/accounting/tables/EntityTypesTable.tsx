'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { TypeChip } from '@/components/atoms/TypeChip';
import { AddEntityTypePanel } from '@/components/organisms/accounting/panels/AddEntityTypePanel';
import { ENTITY_ACCOUNTING_RELATION_LABELS, EntityType } from '@/types/accounting';
import { ENTITY_ACCOUNTING_RELATION_CHIP_COLOR } from '@/lib/accounting/entityAccountingRelation';
import { useDeleteEntityType, useEntityTypes } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 10;

export function EntityTypesTable() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntityType | null>(null);

  const { data, isLoading } = useEntityTypes();
  const { mutate: deleteEntityType, isPending: isDeleting } = useDeleteEntityType();

  const types = useMemo(() => data ?? [], [data]);
  const totalPages = Math.max(1, Math.ceil(types.length / PAGE_SIZE));
  const paged = types.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteEntityType(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Type deleted successfully');
        setDeleteTarget(null);
      },
      onError: (error) => toast.error(extractError(error, 'Unable to delete type')),
    });
  };

  const columns: Column<EntityType>[] = [
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(120px, 1fr)',
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium text-gray-900">{row.name}</span>
          {row.isSystem && <Badge label="System" variant="neutral" />}
        </span>
      ),
    },
    {
      key: 'accountingRelation',
      label: 'Accounting Relation',
      width: '160px',
      render: (row) => (
        <TypeChip
          label={ENTITY_ACCOUNTING_RELATION_LABELS[row.accountingRelation]}
          color={ENTITY_ACCOUNTING_RELATION_CHIP_COLOR[row.accountingRelation]}
        />
      ),
    },
    {
      key: 'entityCount',
      label: 'Entity Count',
      width: '110px',
      className: 'text-right',
      render: (row) => <span className="text-sm text-gray-700">{row.entityCount}</span>,
    },
    {
      key: 'actions',
      label: '',
      width: '90px',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <TableButton
            variant="red"
            disabled={row.isSystem || row.entityCount > 0}
            tooltip={
              row.isSystem
                ? "System type — can't be deleted"
                : row.entityCount > 0
                  ? `Can't delete — ${row.entityCount} ${row.entityCount === 1 ? 'entity uses' : 'entities use'} this type`
                  : undefined
            }
            onClick={() => setDeleteTarget(row)}
          >
            Delete
          </TableButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        emptyMessage="No types defined yet"
        actionButton={{ label: 'Add Type', onClick: () => setPanelOpen(true) }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddEntityTypePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Type"
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
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
