'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pagePx, pageHeader, pageContent } from '@/lib/layout';
import { TabBar, TabGroup } from '@/components/molecules/shared/TabBar';
import { AppBackground } from '@/components/atoms/AppBackground';
import { useCanAccessRoles } from '@/hooks/hr/usePermission';

export default function ReinsuranceSettingsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string }>();
  const base = `/${params.tenantSlug}/operations/reinsurance/settings`;
  const canAccessRoles = useCanAccessRoles();

  const groups: TabGroup[] = [
    {
      tabs: [
        { key: 'risk-classes', label: 'Risk Class', href: `${base}/risk-classes` },
        { key: 'risk-types', label: 'Risk Types', href: `${base}/risk-types` },
      ],
    },
    {
      tabs: [
        { key: 'currency', label: 'Currency', href: `${base}/currency` },
        { key: 'levytaxes', label: 'Taxes and Levies', href: `${base}/levytaxes` },
      ],
    },
    ...(canAccessRoles
      ? [
          {
            tabs: [
              {
                key: 'rolespermissions',
                label: 'Roles and Permissions',
                href: `${base}/rolespermissions`,
              },
            ],
          },
        ]
      : []),
  ];
  // const tabs = [
  //   { key: 'risk-classes', label: 'Risk Class', href: `${base}/risk-classes` },
  //   { key: 'risk-types', label: 'Risk Types', href: `${base}/risk-types` },
  //   { key: 'currency', label: 'Currency', href: `${base}/currency` },
  //   // { key: 'banks', label: 'Banks', href: `${base}/banks` },

  // ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sticky header + tabs */}
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">System Settings</h1>
        </div>
        <TabBar groups={groups} className={pagePx} />
      </div>

      {/* Content */}
      <AppBackground
        as="main"
        className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col')}
      >
        {children}
      </AppBackground>
    </div>
  );
}
