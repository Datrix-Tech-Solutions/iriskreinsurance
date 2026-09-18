'use client';

import { useEffect, useState } from 'react';
import { History, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { MyAttendancePanel } from '@/components/organisms/dashboard/MyAttendancePanel';
import { useClockInLocation } from '@/hooks';
import { cardClass, cn } from '@/lib/utils';

interface AttendanceMetricCardProps {
  clockedIn: boolean;
  isDone: boolean;
  clockInTime?: string;
  /** Raw ISO timestamp of the clock-in, used to tick the live "worked" duration. */
  clockedInAt?: string;
  hoursWorked?: string;
  /** Has an approved leave request covering today — blocks clocking in, front-end side. */
  onLeaveToday?: boolean;
  onClockIn: (location?: string) => void;
  onClockOut: () => void;
  isLoading?: boolean;
}

function formatElapsed(fromMs: number, toMs: number) {
  const mins = Math.max(0, Math.floor((toMs - fromMs) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatClock(d: Date) {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function AttendanceMetricCard({
  clockedIn,
  isDone,
  clockInTime,
  clockedInAt,
  hoursWorked,
  onLeaveToday = false,
  onClockIn,
  onClockOut,
  isLoading = false,
}: AttendanceMetricCardProps) {
  const [confirmClockIn, setConfirmClockIn] = useState(false);
  const [confirmClockOut, setConfirmClockOut] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const location = useClockInLocation();

  // Ticking every second for the live clock / worked duration.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function openClockInConfirm() {
    setConfirmClockIn(true);
    location.capture();
  }

  // Green pulsing state only while a shift is genuinely running.
  const active = clockedIn && !isDone;
  // Blocks clocking in — but someone already clocked in (or done) keeps their normal state.
  const blockedByLeave = onLeaveToday && !clockedIn && !isDone;

  // Prefer the server total; otherwise tick it up locally from the clock-in time.
  const parsedClockInMs = clockedInAt ? Date.parse(clockedInAt) : NaN;
  const liveWorked =
    active && Number.isFinite(parsedClockInMs)
      ? formatElapsed(parsedClockInMs, now.getTime())
      : undefined;
  const worked = hoursWorked ?? liveWorked;

  const summaryValue = (() => {
    if (isDone) return worked ? `worked ${worked}` : '0h 0m';
    if (active && clockInTime) {
      return worked ? `since ${clockInTime} · worked ${worked}` : `since ${clockInTime}`;
    }
    return '0h 0m';
  })();

  return (
    <div className={cardClass('px-5 py-5 flex flex-col gap-4', 'glass')}>
      {/* Header — date + live status */}
      <div className="flex items-center justify-between">
        <span
          className="text-sm text-gray-500 font-medium tracking-wide"
          suppressHydrationWarning
        >
          {formatDate(now)}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 text-[10px] font-semibold tracking-wider',
              active
                ? 'border-green-200 bg-green-50 text-green-700'
                : blockedByLeave
                  ? 'border-purple-200 bg-purple-50 text-purple-600'
                  : 'border-gray-200 bg-gray-100 text-gray-500',
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                active
                  ? 'bg-green-500 animate-pulse'
                  : blockedByLeave
                    ? 'bg-purple-400'
                    : 'bg-gray-400',
              )}
            />
            {active ? 'CLOCKED IN' : blockedByLeave ? 'ON LEAVE' : 'CLOCKED OUT'}
          </span>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Check history"
            className="group flex items-center gap-0 rounded-full py-1 pl-1 pr-1 -m-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 hover:gap-1.5 hover:pr-2.5 transition-all duration-200"
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span className="max-w-0 group-hover:max-w-26 overflow-hidden whitespace-nowrap text-[11px] font-medium transition-all duration-200">
              Check history
            </span>
          </button>
        </div>
      </div>

      {/* Live clock */}
      <div className="text-center py-1">
        <span
          className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-(--module-btn-bg,var(--color-brand))"
          suppressHydrationWarning
        >
          {formatClock(now)}
        </span>
      </div>

      {/* Punch action */}
      {isDone ? (
        <Button
          variant="outline"
          disabled
          className="w-full text-green-700 border-green-200 hover:bg-green-50"
        >
          All done for today
        </Button>
      ) : clockedIn ? (
        <Button
          variant="outline"
          onClick={() => setConfirmClockOut(true)}
          disabled={isLoading}
          className="w-full"
        >
          Clock out
        </Button>
      ) : blockedByLeave ? (
        <Button
          variant="outline"
          disabled
          className="w-full text-purple-600 border-purple-200 hover:bg-purple-50"
        >
          Clock-in unavailable — on leave
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={openClockInConfirm}
          disabled={isLoading}
          className="w-full"
        >
          Clock in
        </Button>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">Today</span>
        <span
          className="font-mono text-sm font-semibold tabular-nums text-gray-900"
          suppressHydrationWarning
        >
          {summaryValue}
        </span>
      </div>

      <Modal
        isOpen={confirmClockIn}
        onClose={() => setConfirmClockIn(false)}
        title="Clock In"
        description="Are you sure you want to clock in?"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmClockIn(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={location.status !== 'ready'}
              onClick={() => {
                setConfirmClockIn(false);
                onClockIn(location.label ?? undefined);
                location.reset();
              }}
              className="bg-brand hover:bg-brand-hover"
            >
              Confirm
            </Button>
          </>
        }
      >
        {location.status === 'loading' && (
          <p className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Detecting your location…
          </p>
        )}
        {location.status === 'ready' && location.label && (
          <p className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {location.label}
          </p>
        )}
        {location.status === 'error' && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-red-500">
              Location unavailable — enable location access to clock in.
            </p>
            <button
              type="button"
              onClick={() => location.capture()}
              className="shrink-0 text-xs font-medium text-brand hover:underline"
            >
              Retry
            </button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={confirmClockOut}
        onClose={() => setConfirmClockOut(false)}
        title="Clock Out"
        description="Are you sure you want to clock out?"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmClockOut(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setConfirmClockOut(false);
                onClockOut();
              }}
              className="bg-brand hover:bg-brand-hover"
            >
              Confirm
            </Button>
          </>
        }
      />

      <MyAttendancePanel isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
