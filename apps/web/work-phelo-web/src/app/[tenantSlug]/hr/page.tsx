'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  useMyProfile,
  useEmployeeOptions,
  useMyTasks,
  useEmployeeDashboard,
  useClockIn,
  useClockOut,
  useUpcomingBirthdays,
} from '@/hooks';
import { useLeaveBalances, useMyLeaveRequests } from '@/hooks/hr/useLeave';
import { useMyPayslips } from '@/hooks/hr/usePayroll';
import { usePublicHolidays } from '@/hooks/hr/usePublicHolidays';
import { formatTime, formatMinutes, resolveHolidayUpcomingDate } from '@/lib/formatters';
import { EmployeeWelcomeCard } from '@/components/molecules/dashboard/EmployeeWelcomeCard';
import { QuickActionsCard } from '@/components/molecules/dashboard/QuickActionsCard';
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
  const { data: employeeOptions = [] } = useEmployeeOptions();
  const { data: balancesRaw } = useLeaveBalances();
  const { data: myLeaveRaw } = useMyLeaveRequests();
  const { data: myPayslipsRaw } = useMyPayslips();
  const { data: myTasksRaw = [] } = useMyTasks();
  const { data: dashboard } = useEmployeeDashboard();
  const { data: holidaysRaw } = usePublicHolidays();
  const { data: birthdaysRaw } = useUpcomingBirthdays();

  const managerName = (() => {
    if (!myProfile?.managerId) return undefined;
    const mgr = employeeOptions.find((e) => e.id === myProfile.managerId);
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : undefined;
  })();

  const leaveBalances = Array.isArray(balancesRaw) ? balancesRaw : [];
  const myLeave = useMemo(() => (Array.isArray(myLeaveRaw) ? myLeaveRaw : []), [myLeaveRaw]);
  const myPayslips = Array.isArray(myPayslipsRaw) ? myPayslipsRaw : [];

  /* ── Panel states ── */
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false);
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

  const handleOpenMyLeave = () => {
    setMyLeaveOpen(true);
    const ids = myLeave
      .filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED')
      .map((r) => r.id);
    setSeenLeaveIds(new Set(ids));
    localStorage.setItem('dashboard_leave_seen_ids', JSON.stringify(ids));
  };

  if (isTenantAdmin) return null;

  return (
    <div className="p-6 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="flex flex-col gap-6">
          <EmployeeWelcomeCard
            fullName={fullName}
            avatarUrl={myProfile?.avatarUrl}
            jobTitle={myProfile?.jobTitle}
            department={myProfile?.department?.name}
            branch={myProfile?.branch?.name}
            managerName={managerName}
            companyName={user?.tenantName}
          />
          <UpcomingHolidaysCard holidays={holidays} />
        </div>

        <div className="flex flex-col gap-6">
          <AttendanceMetricCard
            clockedIn={clockedIn}
            isDone={isDone}
            clockInTime={clockInTime}
            hoursWorked={hoursWorked}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            isLoading={isClockingIn || isClockingOut}
          />
          <AnnouncementCard announcements={announcements} />
        </div>

        <div className="flex flex-col gap-6">
          <QuickActionsCard
            onApplyLeave={() => setApplyLeaveOpen(true)}
            onLeave={handleOpenMyLeave}
            onPayslips={() => setPayslipsOpen(true)}
            onAssets={() => setAssetsOpen(true)}
            onSchedules={() => setSchedulesOpen(true)}
            onProjects={() => setProjectsOpen(true)}
            leaveBadge={leaveBadgeCount}
            projectsBadge={projectsBadgeCount}
          />

          <BirthdaysCard
            birthdays={birthdays}
            scrollRef={birthdayRef}
            onScrollLeft={() => scrollBirthdays('left')}
            onScrollRight={() => scrollBirthdays('right')}
          />
        </div>
      </div>

      {/* Panels */}
      <ApplyLeavePanel
        isOpen={applyLeaveOpen}
        onClose={() => setApplyLeaveOpen(false)}
        tenantSlug={tenantSlug}
        balances={leaveBalances}
      />
      <MyLeavePanel
        isOpen={myLeaveOpen}
        onClose={() => setMyLeaveOpen(false)}
        onRequestLeave={() => {
          setMyLeaveOpen(false);
          setApplyLeaveOpen(true);
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
