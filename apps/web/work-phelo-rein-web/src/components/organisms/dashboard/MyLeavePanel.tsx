'use client';

import { cn } from '@/lib/utils';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { formatDateRange } from '@/lib/formatters';
import type { LeaveRequest } from '@/types/hr';

interface MyLeavePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestLeave: () => void;
  requests: LeaveRequest[];
}

const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'bg-green-50 text-green-700',
  PENDING: 'bg-yellow-50 text-yellow-700',
  REJECTED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-gray-50 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

function LeaveStatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase();
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-semibold',
        STATUS_STYLES[key] ?? 'bg-gray-50 text-gray-600',
      )}
    >
      {STATUS_LABELS[key] ?? status}
    </span>
  );
}

export function MyLeavePanel({ isOpen, onClose, onRequestLeave, requests }: MyLeavePanelProps) {
  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="My Leave"
      description="Your leave request history."
      width="sm:w-[480px]"
      footer={
        <div className="flex justify-end">
          <Button
            onClick={() => {
              onClose();
              onRequestLeave();
            }}
          >
            Request Leave
          </Button>
        </div>
      }
    >
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <p className="text-sm text-gray-400">No leave requests yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-card bg-white"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{r.leaveTypeName ?? 'Leave'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDateRange(r.startDate, r.endDate)}
                </p>
              </div>
              <LeaveStatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </SidePanel>
  );
}
