'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { cardClass, cn } from '@/lib/utils';
import { Avatar } from '@/components/atoms/Avatar';
import type { EmploymentStatus } from '@/types/hr';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  avatarUrl?: string | null;
  status: EmploymentStatus;
  isManager: boolean;
}

interface MyTeamCardProps {
  /** Same department as the viewer, plus their reporting manager. Pre-sorted. */
  members: TeamMember[];
  departmentName?: string;
  viewAllHref: string;
}

const VISIBLE = 6;

const STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  ACTIVE: { label: 'Available', pill: 'border-green-200 bg-green-50 text-green-700', dot: 'bg-green-500' },
  ON_LEAVE: { label: 'On leave', pill: 'border-orange-200 bg-orange-50 text-orange-600', dot: 'bg-orange-400' },
  PROBATION: { label: 'Probation', pill: 'border-blue-200 bg-blue-50 text-blue-600', dot: 'bg-blue-400' },
  SUSPENDED: { label: 'Suspended', pill: 'border-red-200 bg-red-50 text-red-600', dot: 'bg-red-400' },
};

export function MyTeamCard({ members, departmentName, viewAllHref }: MyTeamCardProps) {
  const shown = members.slice(0, VISIBLE);
  const extra = members.length - shown.length;

  return (
    <div className={cardClass('p-3 flex flex-col shrink-0 border-gray-200')}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-base font-bold text-(--module-btn-bg,var(--color-brand))">My Team</h2>
          {departmentName && (
            <span className="text-xs text-gray-400 truncate">· {departmentName}</span>
          )}
        </div>
        {members.length > 0 && (
          <Link href={viewAllHref} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            View all
          </Link>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100 -mx-5 shrink-0" />

      {/* Roster */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400">No one else in your department yet.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-gray-100">
          {shown.map((m) => {
            const s = STATUS[m.status] ?? STATUS.ACTIVE;
            return (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.name} avatarUrl={m.avatarUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                    {m.isManager && (
                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                        Manager
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{m.role}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    s.pill,
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
                  {s.label}
                </span>
              </div>
            );
          })}

          {extra > 0 && (
            <Link
              href={viewAllHref}
              className="py-2.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              +{extra} more
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
