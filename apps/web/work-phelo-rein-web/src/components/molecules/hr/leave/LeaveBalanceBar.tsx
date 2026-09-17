import { cn } from '@/lib/utils';
import { LeaveBalance } from '@/types/hr';

interface LeaveBalanceBarProps {
  balance: LeaveBalance;
  /** Highlight that the requested days exceed the remaining balance */
  overBy?: number;
  className?: string;
}

export function LeaveBalanceBar({ balance, overBy, className }: LeaveBalanceBarProps) {
  const { entitled, used, remaining, pending, leaveTypeName } = balance;

  const usedPct = entitled > 0 ? Math.min(100, (used / entitled) * 100) : 0;
  const pendingPct = entitled > 0 ? Math.min(100 - usedPct, (pending / entitled) * 100) : 0;
  const isOver = (overBy ?? 0) > 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border bg-white p-4',
        isOver ? 'border-orange-200 bg-orange-50' : 'border-gray-200',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{leaveTypeName}</span>
        <span className={cn('text-xs font-medium', isOver ? 'text-orange-600' : 'text-gray-500')}>
          {remaining} / {entitled} days remaining
        </span>
      </div>

      {/* Bar */}
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden flex">
        {/* Used */}
        <div
          className={cn(
            'h-full bg-brand rounded-l-full transition-all',
            pendingPct === 0 && 'rounded-r-full',
          )}
          style={{ width: `${usedPct}%` }}
        />
        {/* Pending */}
        {pendingPct > 0 && (
          <div
            className="h-full bg-amber-400 rounded-r-full transition-all"
            style={{ width: `${pendingPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand inline-block" />
          {used} used
        </span>
        {pending > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            {pending} pending
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />
          {remaining} left
        </span>
      </div>

      {/* Over-balance warning */}
      {isOver && (
        <p className="text-xs text-orange-600 font-medium">
          You only have {remaining} {remaining === 1 ? 'day' : 'days'} available — this request
          needs {(overBy ?? 0) + remaining} days.
        </p>
      )}
    </div>
  );
}
