'use client';

import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { useAccountCategories } from '@/hooks';
import type { AccountCategoryDefinition } from '@/types/accounting';

const PAGE_SIZE = 10;
type AccountCategoryRow = AccountCategoryDefinition & { id: string };

const columns: Column<AccountCategoryRow>[] = [
  {
    key: 'name',
    label: 'Account Type',
    width: 'minmax(180px, 1fr)',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'code',
    label: 'Code',
    width: '150px',
    render: (row) => <span className="text-sm text-gray-700">{row.code}</span>,
  },
  {
    key: 'normalBalance',
    label: 'Normal Balance',
    width: '160px',
    render: (row) => <span className="text-sm text-gray-700">{row.normalBalance}</span>,
  },
  {
    key: 'financialStatement',
    label: 'Financial Statement',
    width: '210px',
    render: (row) => (
      <span className="text-sm text-gray-700">{row.financialStatement.replaceAll('_', ' ')}</span>
    ),
  },
];

export function AccountTypeDefinitionsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data = [], isLoading } = useAccountCategories();
  const rows = useMemo<AccountCategoryRow[]>(
    () => data.map((category) => ({ ...category, id: category.code })),
    [data],
  );
  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((category) =>
      `${category.name} ${category.code}`.toLowerCase().includes(value),
    );
  }, [rows, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <DataTable
      columns={columns}
      data={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
      isLoading={isLoading}
      searchPlaceholder="Search account types…"
      searchValue={search}
      onSearch={(value) => {
        setSearch(value);
        setPage(1);
      }}
      emptyMessage="No account types found"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
    />
  );
}
