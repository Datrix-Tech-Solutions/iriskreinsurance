'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { formatDate, formatTime } from '@/lib/formatters';
import type { CorrectionRequest } from '@/types/timeclock';

interface CorrectionRequestDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  request: CorrectionRequest | null;
}

const STATUS_VARIANT = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
} as const;

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

export function CorrectionRequestDetailPanel({
  isOpen,
  onClose,
  request,
}: CorrectionRequestDetailPanelProps) {
  if (!request) return null;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Correction Request"
      description={`Submitted by ${request.employeeName ?? 'this employee'}`}
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {/* Status */}
      <div className="flex items-center gap-2">
        <Badge variant={STATUS_VARIANT[request.status]} label={request.status} />
        {request.reviewedByName && (
          <span className="text-xs text-gray-400">
            by {request.reviewedByName}
            {request.reviewedAt ? ` · ${formatDate(request.reviewedAt)}` : ''}
          </span>
        )}
      </div>

      {/* Request details */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
        <DetailRow label="Employee">{request.employeeName ?? '—'}</DetailRow>
        <DetailRow label="Date">{formatDate(request.date)}</DetailRow>
        <DetailRow label="Requested In">
          {request.requestedClockIn ? formatTime(request.requestedClockIn) : '—'}
        </DetailRow>
        <DetailRow label="Requested Out">
          {request.requestedClockOut ? formatTime(request.requestedClockOut) : '—'}
        </DetailRow>
        <DetailRow label="Submitted">{formatDate(request.createdAt)}</DetailRow>
      </div>

      {/* Reason */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reason</p>
        <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100">
          {request.reason}
        </p>
      </div>

      {/* Reviewer note */}
      {request.reviewNote && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Reviewer Note
          </p>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100">
            {request.reviewNote}
          </p>
        </div>
      )}
    </SidePanel>
  );
}
