'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { AccountClassification, GLAccountCategory } from '@/types/accounting';
import { AddClassificationPanel } from '@/components/organisms/accounting/panels/AddClassificationPanel';
import {
  useAccountClassifications,
  useActivateAccountClassification,
  useDeactivateAccountClassification,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';

const PAGE_SIZE = 10;

const CATEGORY_LABELS: Record<GLAccountCategory, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
};

export function ClassificationsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, isLoading } = useAccountClassifications();
  const activateClassification = useActivateAccountClassification();
  const deactivateClassification = useDeactivateAccountClassification();

  const classifications = useMemo(() => data?.items ?? [], [data]);

  function toggleActive(classification: AccountClassification) {
    const mutation = classification.isActive ? deactivateClassification : activateClassification;
    mutation.mutate(classification.id, {
      onError: (error) => toast.error(extractError(error)),
    });
  }

  const columns: Column<AccountClassification>[] = [
    {
      key: 'code',
      label: 'Account Code',
      width: '100px',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Account Name',
      width: 'minmax(150px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'category',
      label: 'Account Type',
      width: '100px',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
          {CATEGORY_LABELS[row.category]}
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
    {
      key: 'actions',
      label: '',
      width: '120px',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <TableButton variant={row.isActive ? 'red' : 'green'} onClick={() => toggleActive(row)}>
            {row.isActive ? 'Deactivate' : 'Activate'}
          </TableButton>
        </div>
      ),
    },
  ];

  const filtered = useMemo(() => {
    if (!search) return classifications;
    const q = search.toLowerCase();
    return classifications.filter(
      (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
    );
  }, [classifications, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search classifications…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Classification', onClick: () => setPanelOpen(true) }}
        onRowClick={(row) =>
          router.push(`/${tenantSlug}/accounting/settings/classifications/${row.id}`)
        }
        emptyMessage="No classifications found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <AddClassificationPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
