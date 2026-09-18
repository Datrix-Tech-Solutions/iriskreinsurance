'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateTemplatePanel } from '@/components/organisms/hr/appraisal/CreateTemplatePanel';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { AppraisalTemplate } from '@/types/hr';

interface Props {
  tenantSlug: string;
}

export function AppraisalTemplatesList({ tenantSlug }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<AppraisalTemplate | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AppraisalTemplate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['appraisal-templates', tenantSlug, page, search],
    queryFn: () =>
      api
        .get('/hr/appraisals/templates', { params: { page, search: search || undefined } })
        .then((r) => r.data),
  });

  const templates: AppraisalTemplate[] = Array.isArray(data)
    ? data
    : (data?.data ?? data?.templates ?? []);
  const totalPages: number = data?.totalPages ?? 1;

  const { mutate: deleteTemplate, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/appraisals/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-templates', tenantSlug] });
      toast.success('Template deleted');
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(extractError(err, 'Failed to delete template'));
      setDeleteTarget(null);
    },
  });

  const columns: Column<AppraisalTemplate>[] = [
    {
      key: 'name',
      label: 'Template Name',
      width: 'minmax(150px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'sections',
      label: 'Sections',
      width: 'minmax(200px, 2fr)',
      render: (row) => {
        const titles = row.kpis.map((k) => k.title).join(', ');
        return (
          <span className="text-gray-600 text-sm truncate block max-w-xs" title={titles}>
            {titles || '—'}
          </span>
        );
      },
    },
    {
      key: 'isActive',
      label: 'Status',
      width: '110px',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 text-sm font-medium ${row.isActive ? 'text-green-600' : 'text-gray-500'}`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${row.isActive ? 'bg-green-500' : 'bg-gray-400'}`}
          />
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date Created',
      width: '100px',
      render: (row) => (
        <span className="text-gray-700">
          {new Date(row.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '120px',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <TableButton
            variant="gray"
            onClick={() => {
              setEditTemplate(row);
              setPanelOpen(true);
            }}
          >
            Edit
          </TableButton>
          <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
            Delete
          </TableButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <DataTable
        columns={columns}
        data={templates}
        isLoading={isLoading}
        emptyMessage="No templates yet — create your first one"
        searchPlaceholder="Search templates..."
        onSearch={setSearch}
        actionButton={{
          label: 'New Template',
          onClick: () => {
            setEditTemplate(undefined);
            setPanelOpen(true);
          },
        }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <CreateTemplatePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditTemplate(undefined);
        }}
        tenantSlug={tenantSlug}
        editTemplate={editTemplate}
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Template"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={() => deleteTarget && deleteTemplate(deleteTarget.id)}
            >
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
