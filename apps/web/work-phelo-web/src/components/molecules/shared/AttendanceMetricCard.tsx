'use client';

import { useState } from 'react';
import { Clock, CheckCircle2, Loader2, LogIn, LogOut, MapPin } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { useClockInLocation } from '@/hooks';
import { cardClass, waterIconStyle } from '@/lib/utils';

interface AttendanceMetricCardProps {
  clockedIn: boolean;
  isDone: boolean;
  clockInTime?: string;
  hoursWorked?: string;
  onClockIn: (location?: string) => void;
  onClockOut: () => void;
  isLoading?: boolean;
}

export function AttendanceMetricCard({
  clockedIn,
  isDone,
  clockInTime,
  hoursWorked,
  onClockIn,
  onClockOut,
  isLoading = false,
}: AttendanceMetricCardProps) {
  const [confirmClockIn, setConfirmClockIn] = useState(false);
  const [confirmClockOut, setConfirmClockOut] = useState(false);
  const location = useClockInLocation();

  function openClockInConfirm() {
    setConfirmClockIn(true);
    location.capture();
  }

  // Success green when done; otherwise no real semantic color, so fall back to the module color.
  const iconColor = isDone ? '#22c55e' : 'var(--module-btn-bg, var(--brand))';

  return (
    <div className={cardClass('px-5 py-5 flex flex-col', 'glass')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">
          {clockedIn || isDone ? "Today's Attendance" : 'Clock In'}
        </span>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={waterIconStyle(iconColor)}
        >
          {isDone ? (
            <CheckCircle2
              className="w-4.5 h-4.5"
              style={{ color: `color-mix(in oklab, ${iconColor} 65%, black)` }}
            />
          ) : (
            <Clock
              className="w-4.5 h-4.5"
              style={{ color: `color-mix(in oklab, ${iconColor} 65%, black)` }}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 flex-1 justify-end mt-2">
        <div className="text-sm min-w-0">
          {isDone ? (
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-green-600">All done for today!</p>
              {hoursWorked && <p className="text-xs text-gray-400">{hoursWorked} hours worked</p>}
            </div>
          ) : clockedIn ? (
            <p className="text-gray-700">
              Clocked in at <span className="font-semibold text-gray-900">{clockInTime}</span>
            </p>
          ) : (
            <p className="text-gray-400">You haven&apos;t clocked in yet</p>
          )}
        </div>

        {/* Action Button */}
        <div>
          {isDone ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-full border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed
            </span>
          ) : clockedIn ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmClockOut(true)}
              disabled={isLoading}
              //look for a better for clock out
              icon={<LogOut className="w-4 h-4" />}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              Clock Out
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={openClockInConfirm}
              disabled={isLoading}
              //look for a better for clock in
              icon={<LogIn className="w-4 h-4" />}
              className="bg-brand hover:bg-brand-hover"
            >
              Clock In
            </Button>
          )}
        </div>
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
              onClick={() => {
                setConfirmClockIn(false);
                onClockIn(location.status === 'ready' ? (location.label ?? undefined) : undefined);
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
          <p className="mt-2 text-xs text-gray-400">
            Location unavailable — you can still clock in.
          </p>
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
    </div>
  );
}
