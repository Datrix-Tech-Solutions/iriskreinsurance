'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { AddAgreementPanel } from '@/components/organisms/hr/companyPolicies/AddAgreementPanel';
import { AgreementViewModal } from '@/components/organisms/hr/companyPolicies/AgreementViewModal';
import {
  useCompanyAgreements,
  useMyCompanyAgreements,
  useCreateCompanyAgreement,
  useUpdateCompanyAgreement,
  useDeleteCompanyAgreement,
  usePublishCompanyAgreement,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { cn } from '@/lib/utils';
import type {
  CompanyAgreement,
  CompanyAgreementType,
  CreateCompanyAgreementDto,
  UpdateCompanyAgreementDto,
} from '@/types/hr';

const AGREEMENT_TYPE_LABELS: Record<CompanyAgreementType, string> = {
  NDA: 'Non-Disclosure Agreement',
  EMPLOYMENT_CONTRACT: 'Employment Contract',
  CONFIDENTIALITY: 'Confidentiality Agreement',
  NON_COMPETE: 'Non-Compete Agreement',
  CODE_OF_CONDUCT: 'Code of Conduct',
  IP_ASSIGNMENT: 'IP Assignment Agreement',
  PROBATION_AGREEMENT: 'Probation Agreement',
  OTHER: 'Other',
};

const STATE_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const STATE_CLASS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-orange-100 text-orange-700',
};

const COLUMNS: Column<CompanyAgreement>[] = [
  { key: 'title', label: 'Title' },
  {
    key: 'type',
    label: 'Type',
    render: (row) => AGREEMENT_TYPE_LABELS[row.type] ?? row.type,
  },
  {
    key: 'state',
    label: 'Status',
    render: (row) => (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
          STATE_CLASS[row.state] ?? STATE_CLASS.DRAFT,
        )}
      >
        {STATE_LABEL[row.state] ?? row.state}
      </span>
    ),
  },
  {
    key: 'createdAt',
    label: 'Created',
    render: (row) =>
      new Date(row.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
  },
];

const PAGE_SIZE = 10;

export default function CompanyAgreementsPage() {
  const toast = useToast();
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const user = useAuthStore((s) => s.user);
  const canManage = usePermission(Permission.MANAGE_HR_SETTINGS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editAgreement, setEditAgreement] = useState<CompanyAgreement | null>(null);
  const [viewAgreement, setViewAgreement] = useState<CompanyAgreement | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: allAgreements = [], isLoading: isLoadingAll } = useCompanyAgreements({
    enabled: canManage,
  });
  const { data: myAgreements = [], isLoading: isLoadingMine } = useMyCompanyAgreements({
    enabled: user !== null && !canManage,
  });

  const agreements: CompanyAgreement[] = canManage
    ? allAgreements
    : myAgreements.map((ma) => ma.agreement);
  const isLoading = canManage ? isLoadingAll : isLoadingMine;

  const { mutate: createAgreement, isPending: isCreating } = useCreateCompanyAgreement();
  const { mutate: updateAgreement, isPending: isUpdating } = useUpdateCompanyAgreement();
  const { mutate: deleteAgreement } = useDeleteCompanyAgreement();
  const { mutate: publishAgreement } = usePublishCompanyAgreement();

  const filtered = agreements.filter(
    (a) =>
      (!canManage ? a.state === 'PUBLISHED' : true) &&
      (a.title.toLowerCase().includes(search.toLowerCase()) ||
        (AGREEMENT_TYPE_LABELS[a.type] ?? a.type).toLowerCase().includes(search.toLowerCase())),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = (data: CreateCompanyAgreementDto) => {
    createAgreement(data, {
      onSuccess: () => {
        toast.success('Agreement created');
        setPanelOpen(false);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to create agreement')),
    });
  };

  const handleUpdate = (data: UpdateCompanyAgreementDto) => {
    if (!editAgreement) return;
    updateAgreement(
      { id: editAgreement.id, ...data },
      {
        onSuccess: () => {
          toast.success('Agreement updated');
          setEditAgreement(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to update agreement')),
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteAgreement(id, {
      onSuccess: () => toast.success('Agreement deleted'),
      onError: (err) => toast.error(extractError(err, 'Failed to delete agreement')),
    });
  };

  const handlePublish = (id: string) => {
    publishAgreement(id, {
      onSuccess: () => toast.success('Agreement published'),
      onError: (err) => toast.error(extractError(err, 'Failed to publish agreement')),
    });
  };

  return (
    <div className="flex flex-col">
      <DataTable
        columns={COLUMNS}
        data={paginated}
        isLoading={isLoading}
        emptyMessage="No agreements found"
        searchPlaceholder="Search by title or type…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={
          canManage ? { label: 'Add Agreement', onClick: () => setPanelOpen(true) } : undefined
        }
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
        rowActions={(row) => [
          {
            label: 'View',
            onClick: () => setViewAgreement(row),
          },
          ...(canManage && row.state === 'PUBLISHED'
            ? [
                {
                  label: 'View Signatures',
                  onClick: () =>
                    router.push(
                      `/${tenantSlug}/hr/hrmanagement/companyPolicies/agreements/${row.id}/signatures`,
                    ),
                },
              ]
            : []),
          ...(canManage && row.state === 'DRAFT'
            ? [
                {
                  label: 'Publish',
                  onClick: () => handlePublish(row.id),
                },
                {
                  label: 'Edit',
                  onClick: () => setEditAgreement(row),
                },
                {
                  label: 'Delete',
                  danger: true,
                  onClick: () => handleDelete(row.id),
                },
              ]
            : []),
        ]}
      />

      <AddAgreementPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
      />

      <AddAgreementPanel
        isOpen={!!editAgreement}
        onClose={() => setEditAgreement(null)}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
        agreement={editAgreement}
      />

      <AgreementViewModal
        isOpen={!!viewAgreement}
        agreement={viewAgreement}
        mode="view"
        onClose={() => setViewAgreement(null)}
      />
    </div>
  );
}
