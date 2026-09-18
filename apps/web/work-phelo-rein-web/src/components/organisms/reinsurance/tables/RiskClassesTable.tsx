'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { AddRiskClassPanel } from '@/components/organisms/reinsurance/panels/AddRiskClassPanel';
import { EditRiskClassPanel } from '@/components/organisms/reinsurance/panels/EditRiskClassPanel';
import { useRiskClasses, useDeleteRiskClass } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { extractError } from '@/lib/extractError';
import { RiskClass } from '@/types/reinsurance';

const PAGE_SIZE = 10;

export function RiskClassesTable() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RiskClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RiskClass | null>(null);

  const canEdit = usePermissionRule('operations.reinsurance.settings:EDIT');

  const { data = [], isLoading } = useRiskClasses();
  const { mutate: deleteRiskClass, isPending: isDeleting } = useDeleteRiskClass();

  const columns: Column<RiskClass>[] = [
    {
      key: 'name',
      label: 'Class Name',
      width: '150px',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(200px, 2.5fr)',
      render: (row) => <span className="text-gray-500 text-sm">{row.description ?? '—'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Date Created',
      width: '150px',
      render: (row) => (
        <span className="text-gray-600 text-sm">
          {new Date(row.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(160px, auto)',
      render: (row) => (
        <div className="flex items-center gap-3.5" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <TableButton variant="blue" onClick={() => setEditTarget(row)}>
              Edit
            </TableButton>
          )}
          {canEdit && (
            <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
              Delete
            </TableButton>
          )}
        </div>
      ),
    },
  ];

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) => r.name.toLowerCase().includes(q));
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRiskClass(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Risk class deleted successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete risk class')),
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search risk classes…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={
          canEdit ? { label: 'Add Risk Class', onClick: () => setPanelOpen(true) } : undefined
        }
        emptyMessage="No risk classes found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddRiskClassPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <EditRiskClassPanel riskClass={editTarget} onClose={() => setEditTarget(null)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Risk Class"
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
