'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';

export interface Fleet {
  id: string;
  vehicle: string;
  type: string;
  regNumber: string;
  branch: string;
  dateAdded: string;
  status: 'active' | 'inactive' | 'maintenance';
}

const STATUS_MAP: Record<
  Fleet['status'],
  { label: string; variant: 'success' | 'danger' | 'warning' }
> = {
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'danger' },
  maintenance: { label: 'Under Maintenance', variant: 'warning' },
};

const COLUMNS: Column<Fleet>[] = [
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'type', label: 'Type' },
  { key: 'regNumber', label: 'Reg. Number' },
  { key: 'branch', label: 'Branch' },
  {
    key: 'dateAdded',
    label: 'Date Added',
    render: (row) =>
      row.dateAdded ? (
        new Date(row.dateAdded).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => {
      const { label, variant } = STATUS_MAP[row.status];
      return <Badge label={label} variant={variant} />;
    },
  },
];

interface Props {
  data: Fleet[];
  searchValue: string;
  onSearch: (q: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: Fleet) => void;
  onAdd: () => void;
}

export function FleetsTable({
  data,
  searchValue,
  onSearch,
  currentPage,
  totalPages,
  onPageChange,
  onRowClick,
  onAdd,
}: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      data={data}
      emptyMessage="No fleets added yet"
      searchPlaceholder="Search fleets..."
      searchValue={searchValue}
      onSearch={onSearch}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      actionButton={{ label: 'Add Vehicle', onClick: onAdd }}
      noInternalScroll
    />
  );
}
