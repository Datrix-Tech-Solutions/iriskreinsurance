'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  useMyProfile,
  useMyTasks,
  useEmployeeDashboard,
  useEmployeeOptions,
  useClockIn,
  useClockOut,
  useUpcomingBirthdays,
  useModuleTransition,
} from '@/hooks';
import { useLeaveBalances, useMyLeaveRequests } from '@/hooks/hr/useLeave';
import { useMyPayslips } from '@/hooks/hr/usePayroll';
import { usePublicHolidays } from '@/hooks/hr/usePublicHolidays';
import { useHrSidebarGroups } from '@/hooks/hr/useHrSidebarGroups';
import { formatTime, formatMinutes, resolveHolidayUpcomingDate } from '@/lib/formatters';
import { EmployeeWelcomeCard } from '@/components/molecules/dashboard/EmployeeWelcomeCard';
import { QuickActionsCard } from '@/components/molecules/dashboard/QuickActionsCard';
import { RequestLeaveCard } from '@/components/molecules/dashboard/RequestLeaveCard';
import { UpcomingLeaveCard } from '@/components/molecules/dashboard/UpcomingLeaveCard';
import { MyTeamCard } from '@/components/molecules/dashboard/MyTeamCard';
import { AttendanceMetricCard } from '@/components/molecules/shared/AttendanceMetricCard';
import { AnnouncementCard } from '@/components/molecules/dashboard/announcmentCard';
import { BirthdaysCard } from '@/components/molecules/dashboard/birthdayCard';
import { UpcomingHolidaysCard } from '@/components/molecules/dashboard/UpcomingHolidaysCard';
import { MyLeavePanel } from '@/components/organisms/dashboard/MyLeavePanel';
import { MyPayslipsPanel } from '@/components/organisms/dashboard/MyPayslipsPanel';
import { MyAssetsPanel } from '@/components/organisms/dashboard/MyAssetsPanel';
import { MySchedulesPanel } from '@/components/organisms/dashboard/MySchedulesPanel';
import { MyProjectsPanel } from '@/components/organisms/dashboard/MyProjectsPanel';
import { ApplyLeavePanel } from '@/components/organisms/hr/leave/ApplyLeavePanel';

interface Attendance {
  status?: 'CLOCKED_IN' | 'CLOCKED_OUT';
  clockedInAt?: string;
  totalMinutes?: number;
}

// Same color identities used by ContactCard's avatar.
const AVATAR_COLORS = [
  '#8b5cf6', // violet-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
];
function avatarColor(name: string) {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function EmployeeDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';

  // The dashboard is a self-service "my" view — not available to tenant admins,
  // send them to the employees list instead.
  useEffect(() => {
    if (isTenantAdmin) {
      router.replace(`/${tenantSlug}/hr/employees`);
    }
  }, [isTenantAdmin, router, tenantSlug]);

  const fullName = !authLoading
    ? [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Employee'
    : '';

  const { data: myProfile } = useMyProfile();
  const { data: balancesRaw } = useLeaveBalances();
  const { data: myLeaveRaw } = useMyLeaveRequests();
  const { data: myPayslipsRaw } = useMyPayslips();
  const { data: myTasksRaw = [] } = useMyTasks();
  const { data: employeeOptions = [] } = useEmployeeOptions();
  const { data: dashboard } = useEmployeeDashboard();
  const { data: holidaysRaw } = usePublicHolidays();
  const { data: birthdaysRaw } = useUpcomingBirthdays();

  const leaveBalances = Array.isArray(balancesRaw) ? balancesRaw : [];
  const annualLeaveBalance = leaveBalances.find((b) => /annual/i.test(b.leaveTypeName));
  const myLeave = useMemo(() => (Array.isArray(myLeaveRaw) ? myLeaveRaw : []), [myLeaveRaw]);
  const myPayslips = Array.isArray(myPayslipsRaw) ? myPayslipsRaw : [];

  const upcomingLeave = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return [...myLeave]
      .filter(
        (r) =>
          (r.status === 'APPROVED' || r.status === 'PENDING') &&
          r.startDate.slice(0, 10) >= todayIso,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  }, [myLeave]);

  /* ── My Team — same department as me, plus my reporting manager ── */
  const teamMembers = useMemo(() => {
    const deptId = myProfile?.department?.id;
    const managerId = myProfile?.managerId;
    const rank: Record<string, number> = { ON_LEAVE: 0, SUSPENDED: 1, PROBATION: 2, ACTIVE: 3 };

    return employeeOptions
      .filter(
        (e) =>
          e.id !== myProfile?.id &&
          e.employmentStatus !== 'TERMINATED' &&
          e.employmentStatus !== 'OFFBOARDED' &&
          ((!!deptId && e.department?.id === deptId) || e.id === managerId),
      )
      .map((e) => {
        const name = `${e.firstName} ${e.lastName}`.trim();
        return {
          id: e.id,
          name,
          role: e.jobTitle,
          initials:
            name
              .split(' ')
              .map((p) => p[0] ?? '')
              .join('')
              .slice(0, 2)
              .toUpperCase() || '?',
          color: avatarColor(name),
          status: e.employmentStatus,
          isManager: e.id === managerId,
        };
      })
      .sort((a, b) => {
        if (a.isManager !== b.isManager) return a.isManager ? -1 : 1;
        const byStatus = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        return byStatus !== 0 ? byStatus : a.name.localeCompare(b.name);
      });
  }, [employeeOptions, myProfile?.id, myProfile?.department?.id, myProfile?.managerId]);

  /* ── Panel states ── */
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false);
  const [applyLeaveTypeId, setApplyLeaveTypeId] = useState<string | null>(null);
  const [payslipsOpen, setPayslipsOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [myLeaveOpen, setMyLeaveOpen] = useState(false);
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  /* ── Leave notification badge ── */
  const [seenLeaveIds, setSeenLeaveIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set<string>(JSON.parse(localStorage.getItem('dashboard_leave_seen_ids') ?? '[]'));
    } catch {
      return new Set();
    }
  });

  const leaveBadgeCount = useMemo(
    () =>
      myLeave.filter(
        (r) => (r.status === 'APPROVED' || r.status === 'REJECTED') && !seenLeaveIds.has(r.id),
      ).length,
    [myLeave, seenLeaveIds],
  );

  const projectsBadgeCount = useMemo(
    () => myTasksRaw.filter((t) => t.status !== 'DONE').length,
    [myTasksRaw],
  );

  const announcements = useMemo(
    () =>
      (dashboard?.announcements ?? []).map(
        (a: {
          id: string;
          title: string;
          publishedAt: string;
          body?: string;
          preview?: string;
          isRead?: boolean;
        }) => ({
          id: a.id,
          title: a.title,
          date: new Date(a.publishedAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          body: a.body ?? a.preview ?? '',
          isRead: a.isRead,
        }),
      ),
    [dashboard?.announcements],
  );

  /* ── Upcoming holidays (future only, first 5) ── */
  const holidays = useMemo(() => {
    const now = new Date();
    return (Array.isArray(holidaysRaw) ? holidaysRaw : [])
      .filter(
        (h: { date: string; observedDate?: string }) =>
          resolveHolidayUpcomingDate(h.observedDate ?? h.date) >= now,
      )
      .sort(
        (a: { date: string; observedDate?: string }, b: { date: string; observedDate?: string }) =>
          resolveHolidayUpcomingDate(a.observedDate ?? a.date).getTime() -
          resolveHolidayUpcomingDate(b.observedDate ?? b.date).getTime(),
      )
      .slice(0, 5);
  }, [holidaysRaw]);

  /* ── Birthdays ── */
  const birthdays = useMemo(() => {
    const rawBirthdays = birthdaysRaw?.birthdays ?? [];
    return (Array.isArray(rawBirthdays) ? rawBirthdays : []).map((b) => {
      const name = b.name;
      const initials = name
        .split(' ')
        .map((part) => part[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase();
      return {
        id: b.id,
        name,
        date: new Date(b.dateOfBirth).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
        }),
        initials,
        color: avatarColor(name),
        avatarUrl: b.avatarUrl,
      };
    });
  }, [birthdaysRaw]);

  const birthdayRef = useRef<HTMLDivElement>(null);
  const scrollBirthdays = (dir: 'left' | 'right') => {
    birthdayRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  /* ── Attendance ── */
  const attendance = dashboard?.attendance as Attendance | undefined;
  const [optimisticClockedIn, setOptimisticClockedIn] = useState<boolean | null>(null);
  const clockedIn =
    optimisticClockedIn === true ||
    (optimisticClockedIn === null && attendance?.status === 'CLOCKED_IN');
  const isDone =
    optimisticClockedIn === false ||
    (optimisticClockedIn === null && attendance?.status === 'CLOCKED_OUT');
  const clockInTime = attendance?.clockedInAt ? formatTime(attendance.clockedInAt) : undefined;
  const hoursWorked = attendance?.totalMinutes ? formatMinutes(attendance.totalMinutes) : undefined;

  const { mutate: clockIn, isPending: isClockingIn } = useClockIn();
  const { mutate: clockOut, isPending: isClockingOut } = useClockOut();

  const handleClockIn = (location?: string) => {
    setOptimisticClockedIn(true);
    clockIn(location ? { location } : undefined, {
      onError: () => setOptimisticClockedIn(null),
      onSettled: () => setOptimisticClockedIn(null),
    });
  };

  const handleClockOut = () => {
    setOptimisticClockedIn(false);
    clockOut(undefined, {
      onError: () => setOptimisticClockedIn(null),
      onSettled: () => setOptimisticClockedIn(null),
    });
  };

  const openApplyLeave = (leaveTypeId?: string) => {
    setApplyLeaveTypeId(leaveTypeId ?? null);
    setApplyLeaveOpen(true);
  };

  const handleOpenMyLeave = () => {
    setMyLeaveOpen(true);
    const ids = myLeave
      .filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED')
      .map((r) => r.id);
    setSeenLeaveIds(new Set(ids));
    localStorage.setItem('dashboard_leave_seen_ids', JSON.stringify(ids));
  };

  /* ── Modules the user can access (same source as the sidebar's "Modules" group) ── */
  const sidebarGroups = useHrSidebarGroups(tenantSlug, 'hr');
  const { navigateToModule } = useModuleTransition();
  const accessibleModules = useMemo(() => {
    const group = sidebarGroups.find((g) => g.label === 'Modules');
    return (group?.items ?? [])
      .filter((item) => item.enabled !== false)
      .map((item) => ({ key: item.key, label: item.label, href: item.href }));
  }, [sidebarGroups]);

  if (isTenantAdmin) return null;

  return (
    <div className="p-6 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <EmployeeWelcomeCard fullName={fullName} avatarUrl={myProfile?.avatarUrl} />

      <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.6fr_1fr] gap-6 items-stretch">
        <div className="flex flex-col gap-6">
          <AttendanceMetricCard
            clockedIn={clockedIn}
            isDone={isDone}
            clockInTime={clockInTime}
            clockedInAt={attendance?.clockedInAt}
            hoursWorked={hoursWorked}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            isLoading={isClockingIn || isClockingOut}
          />

          <UpcomingHolidaysCard holidays={holidays} />
        </div>

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_0.5fr] gap-6 items-stretch">
            <RequestLeaveCard
              annualBalance={annualLeaveBalance}
              onRequestLeave={() => openApplyLeave(annualLeaveBalance?.leaveTypeId)}
            />
            <UpcomingLeaveCard request={upcomingLeave} />
          </div>
          <BirthdaysCard
            birthdays={birthdays}
            scrollRef={birthdayRef}
            onScrollLeft={() => scrollBirthdays('left')}
            onScrollRight={() => scrollBirthdays('right')}
          />
          <MyTeamCard
            members={teamMembers}
            departmentName={myProfile?.department?.name}
            viewAllHref={`/${tenantSlug}/hr/employees`}
          />
        </div>

        <div className="flex flex-col gap-6">
          <QuickActionsCard
            onApplyLeave={() => openApplyLeave()}
            onLeave={handleOpenMyLeave}
            onPayslips={() => setPayslipsOpen(true)}
            onAssets={() => setAssetsOpen(true)}
            onSchedules={() => setSchedulesOpen(true)}
            onProjects={() => setProjectsOpen(true)}
            leaveBadge={leaveBadgeCount}
            projectsBadge={projectsBadgeCount}
            modules={accessibleModules}
            onModule={(module) =>
              navigateToModule({
                moduleKey: module.key,
                moduleName: module.label,
                path: module.href,
              })
            }
          />
          <AnnouncementCard announcements={announcements} />
        </div>
      </div>

      {/* Panels */}
      <ApplyLeavePanel
        isOpen={applyLeaveOpen}
        onClose={() => {
          setApplyLeaveOpen(false);
          setApplyLeaveTypeId(null);
        }}
        tenantSlug={tenantSlug}
        balances={leaveBalances}
        initialLeaveTypeId={applyLeaveTypeId ?? undefined}
      />
      <MyLeavePanel
        isOpen={myLeaveOpen}
        onClose={() => setMyLeaveOpen(false)}
        onRequestLeave={() => {
          setMyLeaveOpen(false);
          openApplyLeave();
        }}
        requests={myLeave}
      />
      <MyPayslipsPanel
        isOpen={payslipsOpen}
        onClose={() => setPayslipsOpen(false)}
        payslips={myPayslips}
      />
      <MyAssetsPanel isOpen={assetsOpen} onClose={() => setAssetsOpen(false)} />
      <MySchedulesPanel isOpen={schedulesOpen} onClose={() => setSchedulesOpen(false)} />
      <MyProjectsPanel
        isOpen={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        tenantSlug={tenantSlug}
      />
    </div>
  );
}
