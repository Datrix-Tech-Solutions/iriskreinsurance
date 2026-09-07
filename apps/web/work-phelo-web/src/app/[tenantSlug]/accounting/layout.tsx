'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { Sidebar } from '@/components/organisms/shared/Sidebar';
import { ACCOUNTING_NAV_GROUPS } from '@/config/accounting-nav';
import { AppBackground } from '@/components/atoms/AppBackground';
import { useModuleThemeScope } from '@/hooks';

export default function AccountingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  useModuleThemeScope('accounting');
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );

  const BASE = `/${tenantSlug}/accounting`;

  function prefixItem(item: (typeof ACCOUNTING_NAV_GROUPS)[0]['items'][0]): typeof item {
    return {
      ...item,
      href: `${BASE}${item.href ? `/${item.href}` : ''}`,
      children: item.children?.map(prefixItem),
    };
  }

  const groups = ACCOUNTING_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map(prefixItem),
  }));

  return (
    <AppBackground className="h-dvh overflow-hidden flex layout-accounting">
      <Sidebar groups={groups} collapsed={collapsed} />
      <div className="flex flex-1 min-h-0 min-w-0 flex-col relative">
        <TopNav
          showMenuButton
          onMenuClick={() => setCollapsed((v) => !v)}
          userInitials={initials}
          logoVariant="image"
        />
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
    </AppBackground>
  );
}
