'use client';

import { useState, useMemo } from 'react';
import {
  WeekDayCard,
  DayShift,
  DayShiftType,
} from '@/components/molecules/hr/scheduling/WeekDayCard';
import {
  WeekSelector,
  getSundayOf,
  addDays,
  toISODate,
} from '@/components/molecules/hr/scheduling/WeekSelector';
import { SwapRequestCard, SwapRequest } from '@/components/molecules/hr/scheduling/SwapRequestCard';
import { SwapShiftPanel } from '@/components/organisms/hr/scheduling/SwapShiftPanel';
import {
  useMyScheduleOverview,
  useMyShiftSwaps,
  useRespondToShiftSwap,
  useCancelShiftSwap,
} from '@/hooks/hr/useScheduling';
import { ShiftSwapRequest, ShiftSwapStatus } from '@/types/scheduling';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Button } from '@/components/atoms/Button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

const WEEKDAYS = [
  { label: 'SUN', isoDay: 1 },
  { label: 'MON', isoDay: 2 },
  { label: 'TUE', isoDay: 3 },
  { label: 'WED', isoDay: 4 },
  { label: 'THU', isoDay: 5 },
  { label: 'FRI', isoDay: 6 },
  { label: 'SAT', isoDay: 7 },
];

const STATUS_BADGE: Record<ShiftSwapStatus, { label: string; className: string }> = {
  PENDING_COLLEAGUE: { label: 'Pending Colleague', className: 'bg-amber-100 text-amber-700' },
  PENDING_MANAGER: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  DECLINED: { label: 'Declined', className: 'bg-red-100 text-red-600' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-600' },
  EXPIRED: { label: 'Expired', className: 'bg-gray-100 text-gray-500' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
};

const CANCELLABLE: ShiftSwapStatus[] = ['PENDING_COLLEAGUE', 'PENDING_MANAGER'];

function toCardRequest(r: ShiftSwapRequest): SwapRequest {
  return {
    id: r.id,
    requester: {
      name: r.requesterEmployee
        ? `${r.requesterEmployee.firstName} ${r.requesterEmployee.lastName}`
        : 'Unknown',
    },
    requesterShift: {
      date: r.requesterShiftDate.slice(0, 10),
      startTime: r.requesterSchedule?.startTime ?? '',
      endTime: r.requesterSchedule?.endTime ?? '',
      workMode: r.requesterSchedule?.workMode,
    },
    target: {
      name: r.targetEmployee
        ? `${r.targetEmployee.firstName} ${r.targetEmployee.lastName}`
        : 'Unknown',
    },
    targetShift: {
      date: r.targetShiftDate.slice(0, 10),
      startTime: r.targetSchedule?.startTime ?? '',
      endTime: r.targetSchedule?.endTime ?? '',
      workMode: r.targetSchedule?.workMode,
    },
    reason: r.reason ?? '',
    status: 'PENDING',
  };
}

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

function SwapRequestItem({
  request,
  currentEmployeeId,
  onRespond,
  onCancel,
  respondingId,
  cancellingId,
}: {
  request: ShiftSwapRequest;
  currentEmployeeId: string | undefined;
  onRespond: (id: string, action: 'ACCEPT' | 'DECLINE') => void;
  onCancel: (id: string) => void;
  respondingId: { id: string; action: 'ACCEPT' | 'DECLINE' } | null;
  cancellingId: string | null;
}) {
  const isTarget = request.targetEmployeeId === currentEmployeeId;
  const cardData = toCardRequest(request);
  const badge = STATUS_BADGE[request.status];
  const acceptedAt = formatDateTime(request.colleagueRespondedAt);
  const decisionAt = formatDateTime(request.managerDecisionAt);

  const details = (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {request.status === 'PENDING_COLLEAGUE' && isTarget && (
          <span>
            Awaiting your response until {new Date(request.expiresAt).toLocaleDateString('en-US')}
          </span>
        )}
        {request.status === 'PENDING_COLLEAGUE' && !isTarget && (
          <span>
            Awaiting colleague response until{' '}
            {new Date(request.expiresAt).toLocaleDateString('en-US')}
          </span>
        )}
        {request.status === 'PENDING_MANAGER' && acceptedAt && <span>Accepted {acceptedAt}</span>}
        {request.status === 'APPROVED' && decisionAt && <span>Approved {decisionAt}</span>}
        {request.status === 'DECLINED' && acceptedAt && <span>Declined {acceptedAt}</span>}
        {request.status === 'REJECTED' && decisionAt && <span>Rejected {decisionAt}</span>}
        {request.status === 'EXPIRED' && <span>Request expired</span>}
        {request.status === 'CANCELLED' && <span>Request cancelled</span>}
      </div>

      {request.status === 'PENDING_MANAGER' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The colleague accepted this request. It is now waiting for approver review.
        </div>
      )}

      {request.status === 'APPROVED' && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          This swap has been approved and the new shift assignments are already reflected in the
          schedule.
        </div>
      )}

      {request.status === 'REJECTED' && request.managerRejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-900">Approver Rejection Reason</p>
          <p className="mt-1 text-sm text-red-700">{request.managerRejectionReason}</p>
        </div>
      )}
    </>
  );

  let footer: React.ReactNode;

  if (isTarget) {
    if (request.status === 'PENDING_COLLEAGUE') {
      /* Target employee — awaiting their response */
      footer = (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRespond(request.id, 'DECLINE')}
            isLoading={respondingId?.id === request.id && respondingId.action === 'DECLINE'}
            loadingText="Declining..."
            disabled={respondingId?.id === request.id && respondingId.action === 'ACCEPT'}
          >
            Decline
          </Button>
          <Button
            size="sm"
            className="bg-shift-night hover:bg-shift-night/90 focus:ring-shift-night"
            onClick={() => onRespond(request.id, 'ACCEPT')}
            isLoading={respondingId?.id === request.id && respondingId.action === 'ACCEPT'}
            loadingText="Accepting..."
            disabled={respondingId?.id === request.id && respondingId.action === 'DECLINE'}
          >
            Accept
          </Button>
        </div>
      );
    } else {
      /* Target already responded — show status badge only */
      footer = badge ? (
        <div className="flex justify-end">
          <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', badge.className)}>
            {badge.label}
          </span>
        </div>
      ) : null;
    }
  } else {
    /* Requester — status badge + cancel while still cancellable */
    const canCancel = CANCELLABLE.includes(request.status);
    footer = (
      <div className="flex items-center justify-between gap-3">
        {badge && (
          <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', badge.className)}>
            {badge.label}
          </span>
        )}
        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancel(request.id)}
            isLoading={cancellingId === request.id}
            loadingText="Cancelling..."
          >
            Cancel Request
          </Button>
        )}
      </div>
    );
  }

  return <SwapRequestCard request={cardData} details={details} footer={footer} />;
}

export function MyScheduleTab() {
  const toast = useToast();

  const [weekStart, setWeekStart] = useState<Date>(() => getSundayOf(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [swapPanelOpen, setSwapPanelOpen] = useState(false);
  const [swapShift, setSwapShift] = useState<DayShift | null>(null);
  const [swapDate, setSwapDate] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<{
    id: string;
    action: 'ACCEPT' | 'DECLINE';
  } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const today = toISODate(new Date());

  const weekFrom = toISODate(weekStart);
  const weekTo = toISODate(addDays(weekStart, 6));

  const { data: overview, isLoading } = useMyScheduleOverview({ from: weekFrom, to: weekTo });

  const { data: swapRequests = [] } = useMyShiftSwaps();

  const currentEmployeeId = overview?.employeeId;
  const { mutate: respondToSwap } = useRespondToShiftSwap();
  const { mutate: cancelSwap } = useCancelShiftSwap();

  const handleRespond = (id: string, action: 'ACCEPT' | 'DECLINE') => {
    setRespondingId({ id, action });
    respondToSwap(
      { shiftSwapId: id, payload: { action } },
      {
        onSuccess: () => toast.success(action === 'ACCEPT' ? 'Swap accepted' : 'Swap declined'),
        onSettled: () => setRespondingId(null),
      },
    );
  };

  const handleCancel = (id: string) => {
    setCancellingId(id);
    cancelSwap(id, {
      onSuccess: () => toast.success('Swap request cancelled'),
      onSettled: () => setCancellingId(null),
    });
  };

  const requestsForDay = useMemo(
    () =>
      selectedDate
        ? swapRequests.filter(
            (r) =>
              r.requesterShiftDate.slice(0, 10) === selectedDate ||
              r.targetShiftDate.slice(0, 10) === selectedDate,
          )
        : [],
    [swapRequests, selectedDate],
  );

  const incomingRequests = useMemo(
    () =>
      currentEmployeeId
        ? swapRequests.filter(
            (request) =>
              request.targetEmployeeId === currentEmployeeId &&
              request.status === 'PENDING_COLLEAGUE',
          )
        : [],
    [currentEmployeeId, swapRequests],
  );

  const recentActivity = useMemo(
    () =>
      swapRequests
        .filter(
          (request) =>
            !(
              currentEmployeeId &&
              request.targetEmployeeId === currentEmployeeId &&
              request.status === 'PENDING_COLLEAGUE'
            ),
        )
        .slice(0, 6),
    [currentEmployeeId, swapRequests],
  );

  /* Build a date → DayShift[] map for the current week, then apply swap overrides */
  const shiftsForWeek = useMemo(() => {
    const schedules = overview?.schedules ?? [];
    const assignmentOverrides = overview?.assignmentOverrides ?? [];
    const shiftSwaps = overview?.shiftSwaps ?? [];
    const map: Record<string, DayShift[]> = {};

    for (const s of schedules) {
      for (const { isoDay } of WEEKDAYS) {
        const dayDate = addDays(weekStart, isoDay - 1);
        const date = toISODate(dayDate);
        const dow = dayDate.getDay();
        const from = s.effectiveFrom.slice(0, 10);
        const to = s.effectiveTo?.slice(0, 10) ?? null;

        if (s.dayOfWeek.includes(dow) && from <= date && (to === null || to >= date)) {
          if (!map[date]) map[date] = [];
          map[date].push({
            scheduleId: s.id,
            type: s.shiftType.toLowerCase() as DayShiftType,
            workMode: s.workMode,
            startTime: s.startTime,
            endTime: s.endTime,
          });
        }
      }
    }

    /* Remove dates the employee gave away in approved swaps.
       REQUESTER gave away requesterShiftDate; COLLEAGUE gave away targetShiftDate. */
    for (const swap of shiftSwaps) {
      if (swap.status !== 'APPROVED') continue;
      const givenAwayDate =
        swap.role === 'REQUESTER'
          ? swap.requesterShiftDate.slice(0, 10)
          : swap.targetShiftDate.slice(0, 10);
      delete map[givenAwayDate];
    }

    /* Add the new shifts received from approved swaps */
    for (const o of assignmentOverrides) {
      const date = o.shiftDate.slice(0, 10);
      if (!map[date]) map[date] = [];
      map[date].push({
        scheduleId: o.scheduleId,
        type: o.shiftType.toLowerCase() as DayShiftType,
        workMode: o.workMode,
        startTime: o.startTime,
        endTime: o.endTime,
      });
    }

    return map;
  }, [overview, weekStart]);

  const handleCardClick = (isoDate: string) => {
    setSelectedDate((prev) => (prev === isoDate ? null : isoDate));
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* ── Week navigator ── */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-xs text-gray-400">Your schedule for this week</p>
        <WeekSelector weekStart={weekStart} onPrev={prevWeek} onNext={nextWeek} endOffset={6} />
      </div>

      {/* ── Day cards ── */}
      {isLoading ? (
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="grid grid-cols-7 gap-4 min-w-140">
            {WEEKDAYS.map(({ label }) => (
              <div
                key={label}
                className="flex flex-col rounded-2xl overflow-hidden border-2 border-gray-200"
              >
                {/* Header skeleton */}
                <div className="bg-gray-100 px-4 py-3 flex flex-col items-center gap-2">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                {/* Body skeleton */}
                <div className="flex flex-col flex-1 p-4 min-h-36 bg-white gap-2.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-24" />
                  <div className="flex-1" />
                  <Skeleton className="h-8 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="grid grid-cols-7 gap-4 min-w-140">
            {WEEKDAYS.map(({ label, isoDay }) => {
              const dayDate = addDays(weekStart, isoDay - 1);
              const isoDate = toISODate(dayDate);

              return (
                <WeekDayCard
                  key={label}
                  day={label}
                  date={dayDate.getDate()}
                  isToday={isoDate === today}
                  shifts={shiftsForWeek[isoDate] ?? []}
                  isSelected={selectedDate === isoDate}
                  onClick={() => handleCardClick(isoDate)}
                  onSwapShift={(shift) => {
                    setSwapShift(shift);
                    setSwapDate(isoDate);
                    setSwapPanelOpen(true);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Swap requests for selected day ── */}
      {selectedDate && requestsForDay.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Swap Requests On This Day
          </p>
          <div className="max-h-105 overflow-y-auto flex flex-col gap-4 pr-1">
            {requestsForDay.map((req) => (
              <SwapRequestItem
                key={req.id}
                request={req}
                currentEmployeeId={currentEmployeeId}
                onRespond={handleRespond}
                onCancel={handleCancel}
                respondingId={respondingId}
                cancellingId={cancellingId}
              />
            ))}
          </div>
        </div>
      )}

      {incomingRequests.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Incoming Swap Requests
          </p>
          {incomingRequests.map((req) => (
            <SwapRequestItem
              key={req.id}
              request={req}
              currentEmployeeId={currentEmployeeId}
              onRespond={handleRespond}
              onCancel={handleCancel}
              respondingId={respondingId}
              cancellingId={cancellingId}
            />
          ))}
        </div>
      )}

      {recentActivity.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Recent Swap Activity
            </p>
            <span className="text-xs text-gray-400">Showing latest {recentActivity.length}</span>
          </div>
          {recentActivity.map((req) => (
            <SwapRequestItem
              key={req.id}
              request={req}
              currentEmployeeId={currentEmployeeId}
              onRespond={handleRespond}
              onCancel={handleCancel}
              respondingId={respondingId}
              cancellingId={cancellingId}
            />
          ))}
        </div>
      )}

      <SwapShiftPanel
        isOpen={swapPanelOpen}
        onClose={() => setSwapPanelOpen(false)}
        shift={swapShift}
        date={swapDate}
      />
    </div>
  );
}
