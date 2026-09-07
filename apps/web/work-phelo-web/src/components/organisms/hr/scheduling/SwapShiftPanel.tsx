'use client';

import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { Button } from '@/components/atoms/Button';
import {
  useEligibleShiftSwapColleagues,
  useCreateShiftSwapRequest,
} from '@/hooks/hr/useScheduling';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { DayShift } from '@/components/molecules/hr/scheduling/WeekDayCard';

interface SwapForm {
  targetColleagueId: string;
  reason: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shift: DayShift | null;
  date: string | null;
}

function formatShiftDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')}${period}`;
}

const SHIFT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  morning: { bg: 'bg-green-100', text: 'text-green-700', label: 'Morning' },
  afternoon: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Afternoon' },
  night: { bg: 'bg-shift-night', text: 'text-white', label: 'Night' },
  flexible: { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Flexible' },
};

export function SwapShiftPanel({ isOpen, onClose, shift, date }: Props) {
  const toast = useToast();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SwapForm>({ defaultValues: { targetColleagueId: '', reason: '' } });

  const targetColleagueId = useWatch({ control, name: 'targetColleagueId' });

  const { data: eligibleColleagues = [], isLoading: colleaguesLoading } =
    useEligibleShiftSwapColleagues({
      scheduleId: shift?.scheduleId,
      shiftDate: date ?? undefined,
    });

  const { mutate: createSwapRequest, isPending } = useCreateShiftSwapRequest();

  const selectedColleague = useMemo(
    () => eligibleColleagues.find((c) => c.colleagueEmployeeId === targetColleagueId) ?? null,
    [eligibleColleagues, targetColleagueId],
  );

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (data: SwapForm) => {
    if (!shift?.scheduleId || !date || !selectedColleague) return;

    createSwapRequest(
      {
        requesterScheduleId: shift.scheduleId,
        requesterShiftDate: date,
        targetScheduleId: selectedColleague.scheduleId,
        targetShiftDate: selectedColleague.shiftDate,
        reason: data.reason || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Swap request submitted');
          handleClose();
        },
      },
    );
  };

  const requesterShiftStyle = shift ? (SHIFT_COLORS[shift.type] ?? SHIFT_COLORS.morning) : null;
  const colleagueShiftStyle = selectedColleague
    ? (SHIFT_COLORS[selectedColleague.shiftType.toLowerCase()] ?? SHIFT_COLORS.morning)
    : null;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Swap Shift"
      description="Request a shift swap with a colleague"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            isLoading={isPending}
            loadingText="Submitting…"
            disabled={!targetColleagueId || !selectedColleague}
          >
            Request Swap
          </Button>
        </div>
      }
    >
      {/* Your Shift */}
      {shift && date && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Your Shift
          </p>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <span
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold shrink-0',
                requesterShiftStyle?.bg,
                requesterShiftStyle?.text,
              )}
            >
              {requesterShiftStyle?.label}
            </span>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {shift.startTime && shift.endTime
                  ? `${formatTime(shift.startTime)} – ${formatTime(shift.endTime)}`
                  : '—'}
              </p>
              <p className="text-xs text-gray-400">{formatShiftDate(date)}</p>
            </div>
            {shift.workMode && (
              <span className="ml-auto text-xs text-gray-400 shrink-0">
                {shift.workMode.charAt(0) + shift.workMode.slice(1).toLowerCase()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Swap With */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Swap With</p>

        {colleaguesLoading ? (
          <p className="text-sm text-gray-400 px-1">Loading eligible colleagues…</p>
        ) : eligibleColleagues.length === 0 ? (
          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-sm text-gray-500">
              No eligible colleagues available for this shift.
            </p>
          </div>
        ) : (
          <>
            <SearchSelect
              label="Colleague"
              placeholder="Search for a colleague…"
              value={targetColleagueId}
              onChange={(v) => setValue('targetColleagueId', v)}
              options={eligibleColleagues.map((c) => ({
                value: c.colleagueEmployeeId,
                label: c.colleagueName,
                sublabel: `${SHIFT_COLORS[c.shiftType.toLowerCase()]?.label ?? c.shiftType} · ${formatTime(c.startTime)} – ${formatTime(c.endTime)}`,
              }))}
              error={errors.targetColleagueId?.message}
            />

            {/* Selected colleague's shift details */}
            {selectedColleague && (
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0',
                    colleagueShiftStyle?.bg,
                    colleagueShiftStyle?.text,
                  )}
                >
                  {colleagueShiftStyle?.label}
                </span>
                <p className="text-sm text-green-700 font-medium">
                  {formatTime(selectedColleague.startTime)} –{' '}
                  {formatTime(selectedColleague.endTime)}
                </p>
                <span className="ml-auto text-xs text-green-600 opacity-70 shrink-0">
                  {selectedColleague.workMode.charAt(0) +
                    selectedColleague.workMode.slice(1).toLowerCase()}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reason */}
      <FormField
        label="Reason for Swap"
        registration={register('reason', { required: 'Please provide a reason' })}
        error={errors.reason}
        type="textarea"
        rows={4}
        placeholder="Explain why you need this shift swap…"
      />
    </SidePanel>
  );
}
