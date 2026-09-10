'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { cn, cardClass } from '@/lib/utils';
import { TableButton } from '@/components/atoms/TableButton';
import { LeaveRequestDetailPanel } from '@/components/organisms/hr/leave/LeaveRequestDetailPanel';
import { useLeaveBalances, useMyLeaveRequests, useLeaveRequests } from '@/hooks/hr/useLeave';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import type { LeaveBalance, LeaveRequest } from '@/types/hr';

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const startStr = s.toLocaleDateString('en-GB', sameMonth ? { day: 'numeric' } : opts);
  const endStr = e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(iso);
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - today.getTime()) / 86_400_000);
  if (diff <= 0) return 'starts today';
  if (diff === 1) return 'in 1 day';
  return `in ${diff} days`;
}

interface Props {
  onSelect?: (leaveTypeId: string) => void;
}

// Distinct per-leave accents — kept neutral at rest, revealed on hover as
// a surface tint, border and shadow. Full class strings so Tailwind keeps them.
const ACCENTS = [
  'hover:border-blue-300 hover:bg-blue-50/60 hover:shadow-blue-100',
  'hover:border-sky-300 hover:bg-sky-50/60 hover:shadow-sky-100',
  'hover:border-cyan-300 hover:bg-cyan-50/60 hover:shadow-cyan-100',
  'hover:border-teal-300 hover:bg-teal-50/60 hover:shadow-teal-100',
  'hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-emerald-100',
  'hover:border-indigo-300 hover:bg-indigo-50/60 hover:shadow-indigo-100',
  'hover:border-violet-300 hover:bg-violet-50/60 hover:shadow-violet-100',
  'hover:border-purple-300 hover:bg-purple-50/60 hover:shadow-purple-100',
];

function accentFor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

function HeaderTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative px-1 pb-2 pt-1 text-sm font-semibold transition-colors whitespace-nowrap',
        active
          ? 'text-(--module-btn-bg,var(--color-brand)) after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-(--module-btn-bg,var(--color-brand))'
          : 'text-gray-400 hover:text-gray-600',
      )}
    >
      {children}
    </button>
  );
}

export function ProfileLeaveBalancesSection({ onSelect }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canReadAllLeaves = usePermission(Permission.READ_ALL_LEAVES);
  const canManageLeaveTypes = usePermission(Permission.MANAGE_LEAVE_TYPES);
  const canManage = canApproveLeave || canReadAllLeaves || canManageLeaveTypes;

  const { data: balancesRaw, isLoading } = useLeaveBalances();
  const balances: LeaveBalance[] = Array.isArray(balancesRaw)
    ? balancesRaw
    : ((balancesRaw as { data?: LeaveBalance[] } | undefined)?.data ?? []);

  const { data: myRequests = [] } = useMyLeaveRequests();
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextLeave: LeaveRequest | undefined = [...myRequests]
    .filter((r) => r.status === 'APPROVED' && r.startDate.slice(0, 10) >= todayIso)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const eligible = balances.filter((b) => b.entitled > 0);

  // Requests awaiting this user's review — only surfaced as a tab if there are any.
  const { data: pendingRaw = [] } = useLeaveRequests('PENDING', { enabled: canApproveLeave });
  const pending = (pendingRaw as LeaveRequest[]) ?? [];
  const showRequestsTab = canApproveLeave && pending.length > 0;

  const [tab, setTab] = useState<'balances' | 'requests'>('balances');
  const activeTab = showRequestsTab ? tab : 'balances';

  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  if (isLoading) return null;

  return (
    <div className={cardClass('overflow-hidden')}>
      {/* Tabbed header */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 pt-1">
        <div className="flex items-center gap-4">
          <HeaderTab active={activeTab === 'balances'} onClick={() => setTab('balances')}>
            Leave Balances
          </HeaderTab>
          {showRequestsTab && (
            <HeaderTab active={activeTab === 'requests'} onClick={() => setTab('requests')}>
              Requests
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold leading-none text-white">
                {pending.length}
              </span>
            </HeaderTab>
          )}
        </div>
        {canManage && (
          <TableButton variant="blue" onClick={() => router.push(`/${tenantSlug}/hr/leave`)}>
            Manage
          </TableButton>
        )}
      </div>

      {activeTab === 'balances' ? (
        <div className="overflow-x-auto">
          <div className="flex gap-4 px-6 py-5" style={{ width: 'max-content', minWidth: '100%' }}>
            {/* Reserved slot — the closest upcoming approved leave */}
            <div
              className={`w-60 shrink-0 flex flex-col gap-2 p-4 rounded-2xl border ${
                nextLeave ? 'border-brand/30 bg-brand/5' : 'border-dashed border-gray-200 bg-gray-50/60'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <CalendarClock className="w-3.5 h-3.5" />
                Upcoming Leave
              </div>
              {nextLeave ? (
                <>
                  <p className="text-sm font-semibold text-gray-900">{nextLeave.leaveTypeName}</p>
                  <p className="text-xs text-gray-500">
                    {formatRange(nextLeave.startDate, nextLeave.endDate)}
                  </p>
                  <div className="mt-auto flex items-center justify-between text-xs">
                    <span className="font-medium text-brand">{daysUntil(nextLeave.startDate)}</span>
                    <span className="text-gray-400">
                      {nextLeave.totalDays} day{nextLeave.totalDays !== 1 ? 's' : ''}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400 my-auto">No upcoming leave scheduled.</p>
              )}
            </div>

            {eligible.length === 0 ? (
              <p className="w-60 shrink-0 self-center text-sm text-gray-400">
                No eligible leave types.
              </p>
            ) : (
              eligible.map((balance) => {
                const pct =
                  balance.entitled > 0 ? Math.min(100, (balance.used / balance.entitled) * 100) : 0;
                return (
                  <button
                    key={balance.leaveTypeId}
                    type="button"
                    onClick={() => onSelect?.(balance.leaveTypeId)}
                    className={`w-60 shrink-0 text-left flex flex-col gap-3 p-4 rounded-2xl border border-gray-200 bg-white transition-all hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${accentFor(
                      balance.leaveTypeId,
                    )}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{balance.leaveTypeName}</p>
                      <span className="text-xs text-gray-400 shrink-0">
                        {balance.entitled} days/yr
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        <span className="font-semibold text-gray-900">{balance.remaining}</span>{' '}
                        remaining
                      </span>
                      <span className="text-gray-400">{balance.used} used</span>
                    </div>
                    {balance.pending > 0 && (
                      <p className="text-xs text-orange-500">
                        {balance.pending} day{balance.pending !== 1 ? 's' : ''} pending approval
                      </p>
                    )}
                    {balance.carriedOver > 0 && (
                      <p className="text-xs text-blue-500">{balance.carriedOver} carried over</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5 px-6 py-4">
          {pending.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRequest(r)}
              className="text-left flex items-center gap-4 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white transition-all hover:border-brand/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{r.employeeName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.leaveTypeName} · {r.totalDays} day{r.totalDays !== 1 ? 's' : ''}
                </p>
              </div>
              <p className="text-xs font-medium text-gray-600 shrink-0 whitespace-nowrap">
                {formatRange(r.startDate, r.endDate)}
              </p>
            </button>
          ))}
        </div>
      )}

      <LeaveRequestDetailPanel
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        tenantSlug={tenantSlug}
        request={selectedRequest}
        canReview={canApproveLeave}
      />
    </div>
  );
}
