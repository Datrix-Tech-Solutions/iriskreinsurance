'use client';

import { cardClass, cn } from '@/lib/utils';
import type { LeaveRequest } from '@/types/hr';

interface UpcomingLeaveCardProps {
  /** The relevant leave request: the one currently in progress if `isCurrent`,
   *  otherwise the next approved/pending one. Omit for no upcoming leave. */
  request?: LeaveRequest;
  /** True when `request` is happening right now (today falls inside its range). */
  isCurrent?: boolean;
}

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const startStr = s.toLocaleDateString('en-GB', sameMonth ? { day: 'numeric' } : opts);
  const endStr = e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(iso);
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - today.getTime()) / 86_400_000);
  if (diff <= 0) return 'starts today';
  if (diff === 1) return 'in 1 day';
  return `in ${diff} days`;
}

function backOn(endIso: string) {
  const back = new Date(endIso);
  back.setDate(back.getDate() + 1);
  return back.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function UpcomingLeaveCard({ request, isCurrent = false }: UpcomingLeaveCardProps) {
  const pending = request?.status === 'PENDING';

  return (
    <div className={cardClass('px-5 py-5 flex flex-col gap-3', 'glass')}>
      <span className="text-sm text-gray-500 font-medium tracking-wide">
        {isCurrent ? 'On Leave' : 'Upcoming Leave'}
      </span>

      {request ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{request.leaveTypeName}</p>
            <span
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide',
                isCurrent
                  ? 'border-purple-200 bg-purple-50 text-purple-600'
                  : pending
                    ? 'border-orange-200 bg-orange-50 text-orange-600'
                    : 'border-green-200 bg-green-50 text-green-700',
              )}
            >
              {isCurrent ? 'ON LEAVE' : pending ? 'PENDING' : 'APPROVED'}
            </span>
          </div>
          <p className="text-xs text-gray-500">{formatRange(request.startDate, request.endDate)}</p>
          <div className="mt-auto flex items-center justify-between text-xs">
            {isCurrent ? (
              <>
                <span className="font-medium text-purple-600">Ongoing</span>
                <span className="text-gray-400">back {backOn(request.endDate)}</span>
              </>
            ) : (
              <>
                <span className="font-medium text-(--module-btn-bg,var(--color-brand))">
                  {daysUntil(request.startDate)}
                </span>
                <span className="text-gray-400 tabular-nums">
                  {request.totalDays} day{request.totalDays === 1 ? '' : 's'}
                </span>
              </>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 my-auto">No upcoming leave scheduled.</p>
      )}
    </div>
  );
}
