// EXECUTIVE DASHBOARD

'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { ModuleOverviewCard } from '@/components/molecules/executive/ModuleOverviewCard';
import { HrOverviewCard } from '@/components/organisms/executive/HrOverviewCard';
import { ModuleIcons, MODULE_COLORS } from '@/components/atoms/icons';

/* ── Modules shown on the executive dashboard — excludes Recruitment ── */
const OVERVIEW_MODULES = [
  { key: 'marketing', name: 'Marketing', icon: <ModuleIcons.marketing className="w-4 h-4" /> },
  { key: 'accounting', name: 'Accounting', icon: <ModuleIcons.accounting className="w-4 h-4" /> },
  { key: 'operations', name: 'Operations', icon: <ModuleIcons.operations className="w-4 h-4" /> },
];

export default function ExecutiveDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';

  useEffect(() => {
    if (user && !isTenantAdmin) {
      router.replace(`/${tenantSlug}/modules`);
    }
  }, [user, isTenantAdmin, router, tenantSlug]);

  if (!isTenantAdmin) return null;

  return (
    <main className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-3 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <HrOverviewCard />
          {OVERVIEW_MODULES.map((mod) => (
            <ModuleOverviewCard
              key={mod.key}
              name={mod.name}
              icon={mod.icon}
              color={MODULE_COLORS[mod.key]}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
