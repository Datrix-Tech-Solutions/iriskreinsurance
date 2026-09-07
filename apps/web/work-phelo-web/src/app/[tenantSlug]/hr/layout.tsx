// HUMAN RESOURCE MODULE LAYOUT //

'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { Sidebar } from '@/components/organisms/shared/Sidebar';
import { HR_NAV_GROUPS } from '@/config/hr-nav';
import { usePermission, usePermissionRule } from '@/hooks/hr/usePermission';
import { useModuleThemeScope } from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { AppraisalReminderModal } from '@/components/organisms/hr/appraisal/AppraisalReminderModal';
import { AgreementGate } from '@/components/organisms/hr/companyPolicies/AgreementGate';
import { LeaveReminderModal } from '@/components/organisms/hr/leave/LeaveReminderModal';
import { TimeCorrectionReminderModal } from '@/components/organisms/hr/time-clock/TimeCorrectionReminderModal';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function HRLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  useModuleThemeScope('hr');
  const user = useAuthStore((s) => s.user);
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );
  const canReadEmployees = usePermission(Permission.READ_EMPLOYEES);
  const canReadOwnProfile = usePermission(Permission.READ_OWN_PROFILE);
  const canReadOwnLeave = usePermission(Permission.READ_OWN_LEAVE);
  const canReadAllLeaves = usePermission(Permission.READ_ALL_LEAVES);
  const canRequestLeave = usePermission(Permission.REQUEST_LEAVE);
  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canReadOwnReview = usePermission(Permission.READ_OWN_REVIEW);
  const canReadAppraisals = usePermission(Permission.READ_APPRAISALS);
  const canSubmitSelfAssessment = usePermission(Permission.SUBMIT_SELF_ASSESSMENT);
  const canSubmitManagerReview = usePermission(Permission.SUBMIT_MANAGER_REVIEW);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canClockInOut = usePermission(Permission.CLOCK_IN_OUT);
  const canReadAttendance = usePermission(Permission.READ_ATTENDANCE);
  const canSubmitTimeCorrection = usePermission(Permission.SUBMIT_TIME_CORRECTION);
  const canApproveTimeCorrection = usePermission(Permission.APPROVE_TIME_CORRECTION);
  const canReadSchedules = usePermissionRule('schedules:VIEW');
  const canManageSchedules = usePermission(Permission.MANAGE_SCHEDULES);
  const canApproveShiftSwap = usePermission(Permission.APPROVE_SHIFT_SWAP);
  const canReadOwnPayslip = usePermission(Permission.READ_OWN_PAYSLIP);
  const canReadPayroll = usePermission(Permission.READ_PAYROLL);
  const canRunPayroll = usePermission(Permission.RUN_PAYROLL);
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);
  const canManagePayrollSettings = usePermission(Permission.MANAGE_PAYROLL_SETTINGS);
  const canReadAssets = usePermission(Permission.READ_ASSETS);
  const canManageAssets = usePermission(Permission.MANAGE_ASSETS);
  const canAssignAsset = usePermission(Permission.ASSIGN_ASSET);
  const canManageAnnouncements = usePermission(Permission.MANAGE_ANNOUNCEMENTS);
  const canAccessLeave = canReadOwnLeave || canReadAllLeaves || canRequestLeave || canApproveLeave;
  const canAccessAppraisal =
    canReadOwnReview ||
    canReadAppraisals ||
    canSubmitSelfAssessment ||
    canSubmitManagerReview ||
    canConfigureAppraisal;
  const canAccessTimeClock =
    canClockInOut || canReadAttendance || canSubmitTimeCorrection || canApproveTimeCorrection;
  const canAccessScheduling = canReadSchedules || canManageSchedules || canApproveShiftSwap;
  const canAccessPayroll =
    canReadOwnPayslip ||
    canReadPayroll ||
    canRunPayroll ||
    canApprovePayroll ||
    canManagePayrollSettings;
  // Feature toggles from the user's tenant config
  const hrFeatures = user?.featureConfig?.hr ?? {};

  // Only dashboard and management are always active (no toggle exists for them)
  // announcements is also core — it is permission-gated, not feature-toggled
  const coreKeys = new Set(['dashboard', 'management', 'announcements']);
  const navAccess: Record<string, boolean> = {
    // The dashboard is a self-service "my" view (my leave, my payslips, clock in/out) —
    // not relevant for a tenant admin, so it's hidden for that role.
    dashboard: !isTenantAdmin,

    employees: canReadEmployees || canReadOwnProfile,
    leave: canAccessLeave,
    appraisal: canAccessAppraisal,
    timeclock: canAccessTimeClock,
    scheduling: canAccessScheduling,
    payroll: canAccessPayroll,
    assets: canReadAssets || canManageAssets || canAssignAsset,
    projects: true,
    management: true,
    announcements: canManageAnnouncements,
  };

  const groups = HR_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      href: `/${tenantSlug}/hr${item.href ? `/${item.href}` : ''}`,
      enabled: item.enabled !== false && (navAccess[item.key] ?? true),
      active: coreKeys.has(item.key)
        ? true
        : item.key in hrFeatures
          ? hrFeatures[item.key]
          : item.active,
    })),
  }));
  // const groups = HR_NAV_GROUPS.map((group) => ({
  //   ...group,
  //   items: group.items.map((item) => ({
  //     ...item,
  //     href: `/${tenantSlug}/hr${item.href ? `/${item.href}` : ''}`,
  //     active: coreKeys.has(item.key)
  //       ? true
  //       : item.key in hrFeatures
  //         ? hrFeatures[item.key]
  //         : item.active,
  //   })),
  // }));

  return (
    <AppBackground className="h-dvh overflow-hidden flex layout-hr">
      <Sidebar groups={groups} collapsed={collapsed} />
      <div className="flex flex-1 min-h-0 min-w-0 flex-col relative">
        <TopNav
          showMenuButton
          onMenuClick={() => setCollapsed((v) => !v)}
          userInitials={initials}
          logoVariant="image"
        />
        {/* Mobile backdrop: closes sidebar when tapping outside */}
        {!collapsed && (
          <div
            className="absolute inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setCollapsed(true)}
          />
        )}
        <main
          className="flex-1 min-h-0 min-w-0 overflow-y-auto flex flex-col"
          onClick={() => {
            if (!collapsed) setCollapsed(true);
          }}
        >
          {children}
        </main>
      </div>

      {canSubmitManagerReview && <AppraisalReminderModal tenantSlug={tenantSlug} />}
      {canApproveLeave && <LeaveReminderModal tenantSlug={tenantSlug} />}
      {canApproveTimeCorrection && <TimeCorrectionReminderModal tenantSlug={tenantSlug} />}
      {canReadOwnProfile && <AgreementGate />}
    </AppBackground>
  );
}
