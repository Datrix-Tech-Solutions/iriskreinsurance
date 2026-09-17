'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';

export interface Prospect {
  id: string;
  prospectName: string;
  expectedRevenue: string;
  product: string;
  contactNo: string;
  salesStage: string;
  decisionMaker: string;
  lastInteraction: string;
}

const COLUMNS: Column<Prospect>[] = [
  { key: 'prospectName', label: 'Prospect Name' },
  { key: 'expectedRevenue', label: 'Expected Revenue' },
  { key: 'product', label: 'Product' },
  { key: 'contactNo', label: 'Contact No' },
  { key: 'salesStage', label: 'Sales Stage' },
  { key: 'decisionMaker', label: 'Decision Maker' },
  {
    key: 'lastInteraction',
    label: 'Last Interaction',
    render: (row) =>
      row.lastInteraction ? (
        new Date(row.lastInteraction).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
];

interface Props {
  data: Prospect[];
  searchValue: string;
  onSearch: (q: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRowClick: (row: Prospect) => void;
  onAdd: () => void;
}

export function AllProspectsTable({
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
      emptyMessage="No prospects yet"
      searchPlaceholder="Search prospects..."
      searchValue={searchValue}
      onSearch={onSearch}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      actionButton={{ label: 'Add Prospect', onClick: onAdd }}
      noInternalScroll
    />
  );
}
