'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { AddRiskTypePanel } from '@/components/organisms/reinsurance/panels/AddRiskTypePanel';
import { EditRiskTypePanel } from '@/components/organisms/reinsurance/panels/EditRiskTypePanel';
import { useRiskTypes, useDeleteRiskType, useRiskClassOptions } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { extractError } from '@/lib/extractError';
import { RiskType } from '@/types/reinsurance';

const PAGE_SIZE = 10;

function buildColumns(classMap: Map<string, string>): Column<RiskType>[] {
  return [
    {
      key: 'name',
      label: 'Risk Type',
      width: 'minmax(150px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'riskClassId',
      label: 'Risk Class',
      width: 'minmax(150px, 1fr)',
      render: (row) => (
        <span className="text-gray-700">{classMap.get(row.riskClassId) ?? '—'}</span>
      ),
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
  ];
}

export function RiskTypesTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const toast = useToast();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RiskType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RiskType | null>(null);

  const canEdit = usePermissionRule('operations.reinsurance.settings:EDIT');

  const { data: riskClassOptions = [] } = useRiskClassOptions();
  const { data = [], isLoading } = useRiskTypes(selectedClassId);
  const { mutate: deleteRiskType, isPending: isDeleting } = useDeleteRiskType();

  const classMap = useMemo(
    () => new Map(riskClassOptions.map((o) => [o.value, o.label])),
    [riskClassOptions],
  );
  const columns: Column<RiskType>[] = [
    ...buildColumns(classMap),
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
    deleteRiskType(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Risk type deleted successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete risk type')),
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading && !!selectedClassId}
        searchPlaceholder="Search risk types…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={
          <div className="w-52">
            <SearchSelect
              placeholder="Filter by risk class…"
              size="sm"
              value={selectedClassId}
              onChange={(v) => {
                setSelectedClassId(v);
                setPage(1);
                setSearch('');
              }}
              options={riskClassOptions}
            />
          </div>
        }
        onRowClick={(row) =>
          router.push(`/${tenantSlug}/operations/reinsurance/settings/risk-types/${row.id}`)
        }
        actionButton={
          canEdit ? { label: 'Add Risk Type', onClick: () => setPanelOpen(true) } : undefined
        }
        emptyMessage={
          selectedClassId ? 'No risk types found' : 'Select a risk class to view its types'
        }
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddRiskTypePanel
        isOpen={panelOpen}
        defaultRiskClassId={selectedClassId}
        onClose={() => setPanelOpen(false)}
      />

      <EditRiskTypePanel riskType={editTarget} onClose={() => setEditTarget(null)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Risk Type"
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
