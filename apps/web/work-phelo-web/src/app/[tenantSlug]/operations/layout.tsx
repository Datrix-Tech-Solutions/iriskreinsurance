// OPERATIONS MODULE LAYOUT //

'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { Sidebar } from '@/components/organisms/shared/Sidebar';
import { REINSURANCE_NAV_GROUPS } from '@/config/reinsurance-nav';
import { AppBackground } from '@/components/atoms/AppBackground';
import { useModuleThemeScope } from '@/hooks';

export default function OperationsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  useModuleThemeScope('operations');
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );

  const BASE = `/${tenantSlug}/operations/reinsurance`;

  // Recursively prefix hrefs with the module base path
  function prefixItem(item: (typeof REINSURANCE_NAV_GROUPS)[0]['items'][0]): typeof item {
    return {
      ...item,
      href: `${BASE}${item.href ? `/${item.href}` : ''}`,
      children: item.children?.map(prefixItem),
    };
  }

  const groups = REINSURANCE_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map(prefixItem),
  }));

  return (
    <AppBackground className="h-dvh overflow-hidden flex layout-operations">
      <Sidebar groups={groups} collapsed={collapsed} />
      <div className="flex flex-1 min-h-0 min-w-0 flex-col relative">
        <TopNav
          showMenuButton
          onMenuClick={() => setCollapsed((v) => !v)}
          userInitials={initials}
          logoVariant="image"
        />
        {/* Mobile backdrop */}
        {!collapsed && (
          <div
            className="absolute inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setCollapsed(true)}
          />
        )}
        <main
          className="flex-1 min-h-0 overflow-y-auto flex flex-col"
          onClick={() => {
            if (!collapsed) setCollapsed(true);
          }}
        >
          {children}
        </main>
      </div>
    </AppBackground>
  );
}
