'use client';

import { CalendarClock } from 'lucide-react';
import { cardClass } from '@/lib/utils';
import { Avatar } from '@/components/atoms/Avatar';

export interface OnLeavePerson {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** The leave type they're out for — omitted for viewers without permission to see it. */
  leaveType?: string;
}

interface OnLeaveCardProps {
  /** Company-wide, not just the viewer's department — who's out today. */
  people: OnLeavePerson[];
}

const VISIBLE = 6;

export function OnLeaveCard({ people }: OnLeaveCardProps) {
  const shown = people.slice(0, VISIBLE);
  const extra = people.length - shown.length;

  return (
    <div className={cardClass('p-3 flex flex-col shrink-0 border-gray-200')}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold text-(--module-btn-bg,var(--color-brand))">On Leave</h2>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100 -mx-5 shrink-0" />

      {/* List */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400">No one is on leave today.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100">
          {shown.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <Avatar name={p.name} avatarUrl={p.avatarUrl} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-400 truncate">{p.leaveType ?? 'On leave'}</p>
              </div>
            </div>
          ))}

          {extra > 0 && <p className="py-2.5 text-xs font-medium text-gray-400">+{extra} more</p>}
        </div>
      )}
    </div>
  );
}
