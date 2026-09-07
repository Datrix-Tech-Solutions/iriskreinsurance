'use client';

import { useState } from 'react';
import { pageHeader, pagePx, pageContent } from '@/lib/layout';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { ChangePasswordTab } from '@/components/molecules/settings/ChangePasswordTab';
import { AppearanceTab } from '@/components/molecules/settings/AppearanceTab';
import { TabItem } from '@/components/molecules/shared/TabBar';
import { useAuthStore } from '@/store/auth.store';
import { SelfServiceTab } from './SelfServiceTab';
import { DocumentTemplateStudio } from '@/components/organisms/settings/DocumentTemplateStudio';
// import { ReinsuranceAccountingIntegrationControl } from '@/components/organisms/shared/ReinsuranceAccountingIntegrationControl';

type SettingsTab = 'security' | 'appearance' | 'self-service' | 'documents';

const TABS: TabItem[] = [
  { key: 'security', label: 'Change Password' },
  { key: 'appearance', label: 'Appearance' },
];

export function SettingsContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('security');
  const user = useAuthStore((state) => state.user);
  const canManageTenantSettings = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN';
  const tabs: TabItem[] = canManageTenantSettings
    ? [
        ...TABS,
        { key: 'self-service', label: 'Self Service' },
        { key: 'documents', label: 'Document Template' },
      ]
    : TABS;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your account and workspace preferences
        </p>
      </div>

      <div className={`${pagePx} shrink-0`}>
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as SettingsTab)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={pageContent}>
          {activeTab === 'security' && <ChangePasswordTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'self-service' && (
            <div className="flex flex-col gap-8">
              <SelfServiceTab />
              {/* {user?.tenantId && (
                <ReinsuranceAccountingIntegrationControl
                  tenantId={user.tenantId}
                  canManage={user.role === 'SUPER_ADMIN'}
                />
              )} */}
            </div>
          )}
          {activeTab === 'documents' && <DocumentTemplateStudio />}
        </div>
      </div>
    </div>
  );
}
