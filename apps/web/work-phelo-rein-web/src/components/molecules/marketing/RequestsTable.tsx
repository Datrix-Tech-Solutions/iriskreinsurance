'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';

export interface TransportRequest {
  id: string;
  staff: string;
  location: string;
  requestType: string;
  departureTime: string;
  arrivalTime: string;
  transportOfficer: string;
  date: string;
  status: 'pending' | 'approved' | 'in-transit' | 'completed' | 'rejected';
}

const STATUS_MAP: Record<
  TransportRequest['status'],
  { label: string; variant: 'success' | 'danger' | 'warning' | 'info' }
> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'info' },
  'in-transit': { label: 'In Transit', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
};

const COLUMNS: Column<TransportRequest>[] = [
  { key: 'staff', label: 'Staff' },
  { key: 'location', label: 'Location' },
  { key: 'requestType', label: 'Request Type' },
  { key: 'departureTime', label: 'Departure Time' },
  { key: 'arrivalTime', label: 'Arrival Time' },
  { key: 'transportOfficer', label: 'Transport Officer' },
  {
    key: 'date',
    label: 'Date',
    render: (row) =>
      row.date ? (
        new Date(row.date).toLocaleDateString('en-GB', {
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
  data: TransportRequest[];
  searchValue: string;
  onSearch: (q: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: TransportRequest) => void;
  onAdd: () => void;
}

export function RequestsTable({
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
      emptyMessage="No requests found"
      searchPlaceholder="Search requests..."
      searchValue={searchValue}
      onSearch={onSearch}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      actionButton={{ label: 'Add Request', onClick: onAdd }}
      noInternalScroll
    />
  );
}
