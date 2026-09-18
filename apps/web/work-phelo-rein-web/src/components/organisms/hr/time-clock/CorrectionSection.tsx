import { useState } from 'react';
import { formatDate, formatTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Column, DataTable } from '../../shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { CorrectionRequestDetailPanel } from './CorrectionRequestDetailPanel';
import type { CorrectionRequest } from '@/types/timeclock';

interface Props {
  corrections: CorrectionRequest[];
  correctionsLoading: boolean;
  correctionStatusFilter: 'PENDING' | 'APPROVED' | 'REJECTED';
  onStatusFilterChange: (status: 'PENDING' | 'APPROVED' | 'REJECTED') => void;
  pendingCount: number;
  onReview: (req: CorrectionRequest, action: 'APPROVED' | 'REJECTED') => void;
}

export function CorrectionsSection({
  corrections,
  correctionsLoading,
  correctionStatusFilter,
  onStatusFilterChange,
  pendingCount,
  onReview,
}: Props) {
  const [viewTarget, setViewTarget] = useState<CorrectionRequest | null>(null);

  const correctionsColumns: Column<CorrectionRequest>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      width: 'minmax(150px,1fr)',
      render: (r) => <span className="font-medium">{r.employeeName}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      width: '100px',
      render: (r) => <span>{formatDate(r.date)}</span>,
    },
    {
      key: 'requestedClockIn',
      label: 'Requested In',
      width: '100px',
      render: (r) => <span>{r.requestedClockIn ? formatTime(r.requestedClockIn) : '—'}</span>,
    },
    {
      key: 'requestedClockOut',
      label: 'Requested Out',
      width: '100px',
      render: (r) => <span>{r.requestedClockOut ? formatTime(r.requestedClockOut) : '—'}</span>,
    },
    {
      key: 'reason',
      label: 'Reason',
      width: 'minmax(200px,1.5fr)',
      render: (r) => <span className="line-clamp-1">{r.reason}</span>,
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      width: '100px',
      render: (r) => <span>{formatDate(r.createdAt)}</span>,
    },
    // {
    //   key: 'status',
    //   label: 'Status',
    //   render: (r) => {
    //     const map = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const;
    //     return <Badge variant={map[r.status as keyof typeof map]} label={r.status} />;
    //   },
    // },
    {
      key: 'view' as keyof CorrectionRequest,
      label: '',
      width: '90px',
      render: (r) =>
        r.status === 'PENDING' ? null : (
          <TableButton variant="blue" onClick={() => setViewTarget(r)}>
            View
          </TableButton>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 shrink-0">
        {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onStatusFilterChange(s)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              correctionStatusFilter === s
                ? 'bg-brand text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {s === 'PENDING'
              ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}`
              : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <DataTable
        columns={correctionsColumns}
        data={corrections}
        isLoading={correctionsLoading}
        emptyMessage={`No ${correctionStatusFilter.toLowerCase()} correction requests`}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
        rowActions={(row) =>
          row.status === 'PENDING'
            ? [
                { label: 'Approve', onClick: () => onReview(row, 'APPROVED') },
                { label: 'Reject', danger: true, onClick: () => onReview(row, 'REJECTED') },
              ]
            : []
        }
      />

      <CorrectionRequestDetailPanel
        isOpen={!!viewTarget}
        onClose={() => setViewTarget(null)}
        request={viewTarget}
      />
    </div>
  );
}
