import { Skeleton } from '@/components/atoms/Skeleton';
import { WEEKDAYS } from './WeekSelector';

const SKELETON_ROWS = 6;
const SKELETON_HAS_SHIFT = [
  [true, false, true, false, true, false, true],
  [false, true, false, true, false, true, false],
  [true, true, false, false, true, false, true],
  [false, false, true, false, false, true, false],
  [true, false, false, true, true, false, false],
  [false, true, true, false, false, true, true],
];

export function SchedulingGridSkeleton() {
  return (
    <div
      className="border border-gray-200 rounded-card bg-white shadow-sm overflow-hidden"
      style={{ minWidth: 1000 }}
    >
      {/* Header */}
      <div
        className="grid bg-gray-50 border-b border-gray-200"
        style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
      >
        <div className="px-5 py-3.5">
          <Skeleton className="h-3 w-16" />
        </div>
        {WEEKDAYS.map(({ label }) => (
          <div key={label} className="px-4 py-3.5 text-center border-l border-gray-200">
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: SKELETON_ROWS }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="grid border-t border-gray-100"
          style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
        >
          <div className="px-5 py-4 border-r border-gray-100 flex items-center">
            <Skeleton className="h-4 w-28" />
          </div>
          {WEEKDAYS.map(({ label }, colIdx) => (
            <div key={label} className="border-l border-gray-100 p-3 min-h-20">
              {SKELETON_HAS_SHIFT[rowIdx][colIdx] && (
                <Skeleton className="h-10 w-full rounded-xl" />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
