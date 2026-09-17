'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, LogIn, LogOut, MapPin } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { useClockInLocation } from '@/hooks';
import type { TodaySession } from '@/types/timeclock';

interface Props {
  now: Date;
  session: TodaySession | undefined;
  isLoading: boolean;
  isClockedIn: boolean;
  isOnBreak: boolean;
  isDone: boolean;
  onClockIn: (location?: string) => void;
  onClockOut: () => void;
  isClockingIn: boolean;
  isClockingOut: boolean;
}

function formatBannerDate(d: Date) {
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return { date, time };
}

export function ClockBanner({
  now,
  session,
  isLoading,
  isClockedIn,
  isOnBreak,
  isDone,
  onClockIn,
  onClockOut,
  isClockingIn,
  isClockingOut,
}: Props) {
  const [confirmClockIn, setConfirmClockIn] = useState(false);
  const [confirmClockOut, setConfirmClockOut] = useState(false);
  const { date, time } = formatBannerDate(now);
  const isActive = isClockedIn || isOnBreak;
  const location = useClockInLocation();

  function openClockInConfirm() {
    setConfirmClockIn(true);
    location.capture();
  }

  return (
    <>
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{
          background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-gradient-end) 100%)',
        }}
      >
        <div>
          <p className="text-blue-300 text-xs font-medium">{date}</p>
          <p className="text-white text-base font-semibold tabular-nums">{time}</p>
          {session?.isLate && isClockedIn && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-orange-500/20 rounded-full">
              <AlertCircle className="w-3 h-3 text-orange-300" />
              <span className="text-orange-300 text-xs font-medium">Late arrival</span>
            </span>
          )}
          {session?.isOutsideSchedule && isClockedIn && (
            <span className="inline-flex items-center gap-1 mt-1 ml-2 px-2 py-0.5 bg-amber-500/20 rounded-full">
              <AlertCircle className="w-3 h-3 text-amber-200" />
              <span className="text-amber-200 text-xs font-medium">No active schedule</span>
            </span>
          )}
          {session?.workMode && isClockedIn && (
            <span className="inline-flex items-center gap-1 mt-1 ml-2 px-2 py-0.5 bg-sky-500/20 rounded-full">
              <span className="text-sky-200 text-xs font-medium">
                {session.workMode.charAt(0) + session.workMode.slice(1).toLowerCase()}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isLoading && <span className="text-blue-300 text-sm">Loading…</span>}
          {!isLoading && isDone && (
            <span className="text-blue-200 text-sm">All done for today!</span>
          )}
          {!isLoading && !isActive && !isDone && (
            <Button
              size="sm"
              onClick={openClockInConfirm}
              isLoading={isClockingIn}
              loadingText="Clocking in…"
              //look for a better for clock in
              icon={<LogIn className="w-4 h-4" />}
              className="bg-white text-brand hover:bg-blue-50 focus:ring-white border-0"
            >
              Clock In
            </Button>
          )}
          {!isLoading && isActive && (
            <Button
              size="sm"
              onClick={() => setConfirmClockOut(true)}
              isLoading={isClockingOut}
              loadingText="Clocking out…"
              //look for a better for clock out
              icon={<LogOut className="w-4 h-4" />}
              className="bg-white text-brand hover:bg-blue-50 focus:ring-white border-0"
            >
              Clock Out
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={confirmClockIn}
        onClose={() => setConfirmClockIn(false)}
        title="Clock In"
        description={`Are you sure you want to clock in at ${time}?`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmClockIn(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirmClockIn(false);
                onClockIn(location.status === 'ready' ? (location.label ?? undefined) : undefined);
                location.reset();
              }}
              className="bg-brand text-white hover:bg-brand-gradient-end"
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
          <p className="mt-2 text-xs text-gray-400">
            Location unavailable — you can still clock in.
          </p>
        )}
      </Modal>

      <Modal
        isOpen={confirmClockOut}
        onClose={() => setConfirmClockOut(false)}
        title="Clock Out"
        description={`Are you sure you want to clock out at ${time}?`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmClockOut(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirmClockOut(false);
                onClockOut();
              }}
              className="bg-brand text-white hover:bg-brand-gradient-end"
            >
              Confirm
            </Button>
          </>
        }
      />
    </>
  );
}
