// HR MANAGEMENT PAGE LAYOUT //

'use client';

import { useEffect } from 'react';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pagePx, pageHeader, pageContent } from '@/lib/layout';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { TabBar, TabGroup } from '@/components/molecules/shared/TabBar';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function HRManagementLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const base = `/${params.tenantSlug}/hr/hrmanagement`;
  const {
    canManageLeaveTypes,
    canConfigureAppraisal,
    canAccessRoles,
    canViewAuditLogs,
    canReadDepartments,
    canReadBranches,
    hasAnyManagementAccess,
  } = useHrManagementAccess();

  // Company Policies tabs (Employment, Cycle Recipients, Agreements) are viewable by all —
  // only redirect away if the user has no management access AND is not on that section.
  const isOnCompanyPolicies = pathname.startsWith(`${base}/companyPolicies`);

  useEffect(() => {
    if (user !== null && !hasAnyManagementAccess && !isOnCompanyPolicies) {
      router.replace(`${base}/companyPolicies`);
    }
  }, [hasAnyManagementAccess, isOnCompanyPolicies, base, router, user]);

  const groups: TabGroup[] = [
    {
      tabs: [
        ...(canReadDepartments
          ? [{ key: 'departments', label: 'Departments', href: `${base}/departments` }]
          : []),
        ...(canReadBranches
          ? [{ key: 'branches', label: 'Branches', href: `${base}/branches` }]
          : []),
      ],
    },
    {
      tabs: canManageLeaveTypes
        ? [
            { key: 'leave-types', label: 'Leave Types', href: `${base}/leave-types` },
            {
              key: 'public-holidays',
              label: 'Public Holidays',
              href: `${base}/public-holidays`,
            },
          ]
        : [],
    },
    {
      tabs: canConfigureAppraisal
        ? [
            {
              key: 'appraisal-templates',
              label: 'Appraisal Templates',
              href: `${base}/appraisal/templates`,
            },
            {
              key: 'appraisal-cycles',
              label: 'Appraisal Cycles',
              href: `${base}/appraisal/cycles`,
            },
            {
              key: 'appraisal-settings',
              label: 'Appraisal Settings',
              href: `${base}/appraisal/settings`,
            },
          ]
        : [],
    },
    {
      tabs: canAccessRoles
        ? [{ key: 'roles', label: 'Roles & Permissions', href: `${base}/roles` }]
        : [],
    },
    {
      tabs: [
        { key: 'company-policies', label: 'Company Policies', href: `${base}/companyPolicies` },
      ],
    },
    {
      tabs: canViewAuditLogs
        ? [{ key: 'audit-logs', label: 'Audit Trail', href: `${base}/audit-logs` }]
        : [],
    },
  ].filter((group) => group.tabs.length > 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Sticky header + tabs */}
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">HR Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure leave types, appraisal templates, cycles, and roles
          </p>
        </div>
        <TabBar groups={groups} className={pagePx} />
      </div>

      {/* Content */}
      <AppBackground
        as="main"
        className={cn(pageContent, 'flex-1 min-h-0 min-w-0 overflow-y-auto flex flex-col')}
      >
        {children}
      </AppBackground>
    </div>
  );
}
