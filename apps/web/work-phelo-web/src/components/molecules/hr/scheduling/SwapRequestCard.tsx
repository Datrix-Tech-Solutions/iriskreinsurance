'use client';

import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { cardClass } from '@/lib/utils';
import Image from 'next/image';

export interface SwapRequestShift {
  date: string; // ISO "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  workMode?: string;
}

export interface SwapRequestPerson {
  name: string;
  avatarUrl?: string;
}

export interface SwapRequest {
  id: string;
  requester: SwapRequestPerson;
  requesterShift: SwapRequestShift;
  target: SwapRequestPerson;
  targetShift: SwapRequestShift;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface Props {
  request: SwapRequest;
  details?: React.ReactNode;
  /** Overrides the entire action/badge row when provided */
  footer?: React.ReactNode;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatWorkMode(workMode?: string): string | null {
  if (!workMode) return null;

  switch (workMode.toUpperCase()) {
    case 'REMOTE':
      return 'Remote';
    case 'HYBRID':
      return 'Hybrid';
    case 'ONSITE':
    default:
      return 'Onsite';
  }
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatarUrl) {
    return (
      <Image src={avatarUrl} alt={name} className="w-14 h-14 rounded-full object-cover shrink-0" />
    );
  }

  return (
    <div className="w-14 h-14 rounded-full bg-[#2d1515] flex items-center justify-center shrink-0">
      <span className="text-white text-sm font-semibold">{initials}</span>
    </div>
  );
}

function ShiftBox({ person, shift }: { person: SwapRequestPerson; shift: SwapRequestShift }) {
  const workMode = formatWorkMode(shift.workMode);

  return (
    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <Avatar name={person.name} avatarUrl={person.avatarUrl} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
        <p className="text-sm text-gray-500 mt-0.5">{formatDate(shift.date)}</p>
        <p className="text-sm font-medium text-blue-600 mt-0.5">
          {shift.startTime} - {shift.endTime}
        </p>
        {workMode && <p className="text-xs text-gray-500 mt-1">{workMode}</p>}
      </div>
    </div>
  );
}

export function SwapRequestCard({
  request,
  details,
  footer,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: Props) {
  const isPending = request.status === 'PENDING';

  return (
    <div className={cardClass('p-5 flex flex-col gap-4')}>
      {/* Shift boxes */}
      <div className="flex items-center gap-3">
        <ShiftBox person={request.requester} shift={request.requesterShift} />

        <div className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
          <ArrowLeftRight className="w-4 h-4 text-gray-400" />
        </div>

        <ShiftBox person={request.target} shift={request.targetShift} />
      </div>

      {/* Reason */}
      <div className="bg-gray-50 rounded-xl px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">Reason for Swap</p>
        <p className="text-sm text-gray-500 mt-1">{request.reason || 'No reason provided'}</p>
      </div>

      {details && <div className="flex flex-col gap-2">{details}</div>}

      {/* Action row — footer overrides default behaviour when provided */}
      {footer !== undefined ? (
        footer
      ) : (
        <>
          {isPending && onApprove && onReject && (
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onReject(request.id)}
                isLoading={isRejecting}
                loadingText="Rejecting..."
                disabled={isApproving}
              >
                Reject
              </Button>
              <Button
                size="sm"
                className="bg-shift-night hover:bg-shift-night/90 focus:ring-shift-night"
                onClick={() => onApprove(request.id)}
                isLoading={isApproving}
                loadingText="Approving..."
                disabled={isRejecting}
              >
                Approve
              </Button>
            </div>
          )}

          {!isPending && (
            <div className="flex justify-end">
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  request.status === 'APPROVED'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {request.status === 'APPROVED' ? 'Approved' : 'Rejected'}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
