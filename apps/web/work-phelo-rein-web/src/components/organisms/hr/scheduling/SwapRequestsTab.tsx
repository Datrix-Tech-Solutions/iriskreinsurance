'use client';

import { type ChangeEvent, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SwapRequestCard, SwapRequest } from '@/components/molecules/hr/scheduling/SwapRequestCard';
import { usePendingManagerShiftSwaps, useReviewShiftSwap } from '@/hooks/hr/useScheduling';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/organisms/shared/Modal';
import { ShiftSwapRequest } from '@/types/scheduling';

const STATUS_FILTERS = [
  { key: 'PENDING_MANAGER', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['key'];

function formatDateTime(value?: string | null): string | null {
  if (!value) return null;

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toCardRequest(s: ShiftSwapRequest): SwapRequest {
  return {
    id: s.id,
    requester: {
      name: s.requesterEmployee
        ? `${s.requesterEmployee.firstName} ${s.requesterEmployee.lastName}`
        : 'Unknown',
    },
    requesterShift: {
      date: s.requesterShiftDate.slice(0, 10),
      startTime: s.requesterSchedule?.startTime ?? '',
      endTime: s.requesterSchedule?.endTime ?? '',
      workMode: s.requesterSchedule?.workMode,
    },
    target: {
      name: s.targetEmployee
        ? `${s.targetEmployee.firstName} ${s.targetEmployee.lastName}`
        : 'Unknown',
    },
    targetShift: {
      date: s.targetShiftDate.slice(0, 10),
      startTime: s.targetSchedule?.startTime ?? '',
      endTime: s.targetSchedule?.endTime ?? '',
      workMode: s.targetSchedule?.workMode,
    },
    reason: s.reason ?? '',
    status: s.status === 'APPROVED' ? 'APPROVED' : s.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
  };
}

function RequestDetails({ request }: { request: ShiftSwapRequest }) {
  const submittedAt = formatDateTime(request.createdAt);
  const decisionAt = formatDateTime(request.managerDecisionAt);
  const acceptedAt = formatDateTime(request.colleagueRespondedAt);
  const managerName = request.managerEmployee
    ? `${request.managerEmployee.firstName} ${request.managerEmployee.lastName}`
    : null;

  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {submittedAt && <span>Submitted {submittedAt}</span>}
        {acceptedAt && request.status !== 'PENDING_COLLEAGUE' && <span>Accepted {acceptedAt}</span>}
        {decisionAt && <span>Reviewed {decisionAt}</span>}
        {managerName && <span>Approver: {managerName}</span>}
      </div>

      {request.status === 'PENDING_MANAGER' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Awaiting approver review.
        </div>
      )}

      {request.status === 'APPROVED' && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Swap approved. The schedule updates are now reflected in both employees&apos; calendars.
        </div>
      )}

      {request.status === 'REJECTED' && request.managerRejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-900">Rejection Reason</p>
          <p className="mt-1 text-sm text-red-700">{request.managerRejectionReason}</p>
        </div>
      )}
    </>
  );
}

export function SwapRequestsTab() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING_MANAGER');
  const [loadingId, setLoadingId] = useState<{ id: string; action: 'APPROVE' | 'REJECT' } | null>(
    null,
  );
  const [rejectTarget, setRejectTarget] = useState<ShiftSwapRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const { data: swaps = [], isLoading } = usePendingManagerShiftSwaps(statusFilter);
  const { mutate: reviewSwap } = useReviewShiftSwap();

  const handleApprove = (id: string) => {
    setLoadingId({ id, action: 'APPROVE' });
    reviewSwap(
      { shiftSwapId: id, payload: { action: 'APPROVE' } },
      {
        onSuccess: () => toast.success('Swap approved'),
        onSettled: () => setLoadingId(null),
      },
    );
  };

  const handleReject = () => {
    if (!rejectTarget) return;

    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError('A rejection reason is required');
      return;
    }

    setLoadingId({ id: rejectTarget.id, action: 'REJECT' });
    reviewSwap(
      { shiftSwapId: rejectTarget.id, payload: { action: 'REJECT', reason } },
      {
        onSuccess: () => {
          toast.success('Swap rejected');
          setRejectTarget(null);
          setRejectReason('');
          setRejectError(null);
        },
        onSettled: () => setLoadingId(null),
      },
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-5 min-h-0">
      <div className="flex gap-2 shrink-0">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              statusFilter === key
                ? 'bg-shift-night text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading…
        </div>
      ) : swaps.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          No {STATUS_FILTERS.find((filter) => filter.key === statusFilter)?.label.toLowerCase()}{' '}
          swap requests
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
          {swaps.map((request) => (
            <SwapRequestCard
              key={request.id}
              request={toCardRequest(request)}
              details={<RequestDetails request={request} />}
              onApprove={statusFilter === 'PENDING_MANAGER' ? handleApprove : undefined}
              onReject={
                statusFilter === 'PENDING_MANAGER'
                  ? () => {
                      setRejectTarget(request);
                      setRejectReason('');
                      setRejectError(null);
                    }
                  : undefined
              }
              isApproving={loadingId?.id === request.id && loadingId.action === 'APPROVE'}
              isRejecting={loadingId?.id === request.id && loadingId.action === 'REJECT'}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={!!rejectTarget}
        onClose={() => {
          if (loadingId?.action === 'REJECT') return;
          setRejectTarget(null);
          setRejectReason('');
          setRejectError(null);
        }}
        title="Reject Shift Swap"
        description="Add a reason that will be shown to both employees."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason('');
                setRejectError(null);
              }}
              disabled={loadingId?.action === 'REJECT'}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              isLoading={loadingId?.id === rejectTarget?.id && loadingId?.action === 'REJECT'}
              loadingText="Rejecting..."
            >
              Confirm Rejection
            </Button>
          </>
        }
      >
        <div className="mt-4">
          <Input
            type="textarea"
            label="Reason"
            value={rejectReason}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              setRejectReason(event.target.value);
              if (rejectError) setRejectError(null);
            }}
            error={rejectError ?? undefined}
            placeholder="Explain why this swap cannot be approved."
          />
        </div>
      </Modal>
    </div>
  );
}
