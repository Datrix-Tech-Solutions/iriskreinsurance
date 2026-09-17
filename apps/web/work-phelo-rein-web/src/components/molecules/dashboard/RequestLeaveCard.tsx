'use client';

import { CalendarCheck, CalendarX } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { cardClass, frostedAvatarStyle } from '@/lib/utils';
import type { LeaveBalance } from '@/types/hr';

interface RequestLeaveCardProps {
  /** The employee's Annual Leave balance — the card's stats reflect this one type only. */
  annualBalance?: LeaveBalance;
  onRequestLeave: () => void;
}

// Teal — same identity as the "Apply for Leave" quick action.
const ACCENT = '#0d9488';

export function RequestLeaveCard({ annualBalance, onRequestLeave }: RequestLeaveCardProps) {
  const entitled = annualBalance?.entitled ?? 0;
  const used = annualBalance?.used ?? 0;
  const remaining = annualBalance?.remaining ?? 0;
  const pending = annualBalance?.pending ?? 0;
  const pct = entitled > 0 ? Math.min(100, (used / entitled) * 100) : 0;

  const stats = [
    { label: 'Balance', value: remaining, icon: CalendarCheck, color: ACCENT },
    { label: 'Used', value: used, icon: CalendarX, color: '#eb6834' },
  ];

  return (
    <div className={cardClass('px-5 py-5 flex flex-col gap-4', 'glass')}>
      {/* Header */}
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-sm text-(--module-btn-bg,var(--color-brand)) font-medium tracking-wide">Annual Leave</span>
        <span className="text-xs text-gray-400">
          {entitled > 0 ? `${entitled} days / year` : 'No annual entitlement'}
        </span>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: ACCENT }}
        />
      </div>

      {/* Balance / Used — annual leave only */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white"
              style={frostedAvatarStyle(color)}
            >
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-lg font-semibold tabular-nums text-gray-900 leading-tight">
                {annualBalance ? value : '—'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {pending > 0 && (
        <p className="text-xs text-orange-500">
          {pending} day{pending === 1 ? '' : 's'} pending approval
        </p>
      )}

      {/* Action */}
      <Button variant="primary" onClick={onRequestLeave} className="w-full">
        Request leave
      </Button>
    </div>
  );
}
