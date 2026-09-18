'use client';

import { useState, useEffect } from 'react';
import { ClockBanner } from '@/components/molecules/hr/time-clock/ClockBanner';
import { ClockStatStrip } from '@/components/molecules/hr/time-clock/ClockStatStrip';
import type { TodaySession } from '@/types/timeclock';

interface Props {
  session: TodaySession | undefined;
  isLoading: boolean;
  onClockIn: (location?: string) => void;
  onClockOut: () => void;
  isClockingIn: boolean;
  isClockingOut: boolean;
}

export function ClockInWidget({
  session,
  isLoading,
  onClockIn,
  onClockOut,
  isClockingIn,
  isClockingOut,
}: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isClockedIn = session?.status === 'CLOCKED_IN';
  const isOnBreak = session?.status === 'ON_BREAK';
  const isActive = isClockedIn || isOnBreak;
  const isDone = !isActive && !!session?.clockOut;

  const sessionMs =
    isActive && session?.clockIn ? now.getTime() - new Date(session.clockIn).getTime() : 0;

  const netMinutes = session
    ? session.totalMinutes + (isActive ? Math.floor(sessionMs / 60000) - session.breakMinutes : 0)
    : 0;

  return (
    <div className="rounded-card overflow-hidden border border-gray-200 shadow-sm">
      <ClockBanner
        now={now}
        session={session}
        isLoading={isLoading}
        isClockedIn={isClockedIn}
        isOnBreak={isOnBreak}
        isDone={isDone}
        onClockIn={onClockIn}
        onClockOut={onClockOut}
        isClockingIn={isClockingIn}
        isClockingOut={isClockingOut}
      />
      <ClockStatStrip session={session} isLoading={isLoading} netMinutes={netMinutes} />
    </div>
  );
}
