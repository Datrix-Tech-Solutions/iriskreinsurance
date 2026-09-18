'use client';

import { useEffect } from 'react';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { TabBar } from '@/components/molecules/shared/TabBar';

const TABS = [
  { key: 'employment', label: 'Employment & Resignation', slug: 'employment' },
  { key: 'agreements', label: 'Company Agreements', slug: 'agreements' },
  { key: 'finances', label: 'Finances', slug: 'finances' },
];

export default function CompanyPoliciesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canReadHrSettings } = useHrManagementAccess();
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  const base = `/${params.tenantSlug}/hr/hrmanagement/companyPolicies`;

  const isOnFinances = pathname === `${base}/finances` || pathname.startsWith(`${base}/finances/`);

  useEffect(() => {
    if (user === null) return;
    // Payroll-only users without HR settings access land on the finances sub-page.
    // All other tabs are viewable by everyone, so no further redirect is needed.
    if (!canReadHrSettings && canManagePayroll && !isOnFinances) {
      router.replace(`${base}/finances`);
    }
  }, [canReadHrSettings, canManagePayroll, isOnFinances, router, user, base]);

  return (
    <div className="flex flex-col">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Company Policies</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure default HR policies for your organisation
        </p>
      </div>

      {/* Tab bar */}
      <TabBar
        className="mt-4"
        tabs={TABS.filter((tab) =>
          tab.slug === 'finances' ? canManagePayroll || canReadHrSettings : true,
        ).map(({ key, label, slug }) => ({ key, label, href: `${base}/${slug}` }))}
      />

      <div className="flex flex-col pt-6">{children}</div>
    </div>
  );
}
