import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShiftSchedule } from '@/types/scheduling';
import { ShiftGridCard } from './ShiftGridCard';

interface Props {
  shifts: ShiftSchedule[];
  canManage: boolean;
  isToday?: boolean;
  isPast?: boolean;
  onAddShift: () => void;
  onOpenDetail: (schedule: ShiftSchedule) => void;
}

export function SchedulingGridCell({
  shifts,
  canManage,
  isToday,
  isPast,
  onAddShift,
  onOpenDetail,
}: Props) {
  const isEmpty = shifts.length === 0;
  const canAdd = canManage && !isPast;

  return (
    <div
      className={cn(
        'group/cell relative border-l border-gray-100 p-3 min-h-20 flex flex-col gap-2',
        isToday && 'bg-blue-100',
        isPast && 'bg-gray-50',
      )}
    >
      {shifts.map((s) => (
        <ShiftGridCard key={s.id} schedule={s} onClick={() => onOpenDetail(s)} />
      ))}

      {/* Empty cell: centred + on hover */}
      {canAdd && isEmpty && (
        <button
          onClick={onAddShift}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity"
          aria-label="Add shift"
        >
          <span className="w-8 h-8 rounded-full bg-(--chip-dark,#111827) flex items-center justify-center shadow-md">
            <Plus className="w-4 h-4 text-white" />
          </span>
        </button>
      )}

      {/* Cell with shifts: small + row at bottom on hover */}
      {canAdd && !isEmpty && (
        <button
          onClick={onAddShift}
          className="flex items-center justify-center w-full rounded-lg border border-dashed border-gray-300 py-1 text-gray-400 hover:border-gray-400 hover:text-gray-600 opacity-0 group-hover/cell:opacity-100 transition-opacity"
          aria-label="Add shift"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
