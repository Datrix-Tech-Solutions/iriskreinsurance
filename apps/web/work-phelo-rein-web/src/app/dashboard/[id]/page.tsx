// TENANT LANDING PAGE //

'use client';

import { use, useMemo, useState } from 'react';
import {
  useTenant,
  useTenantUsers,
  useTenantAudit,
  useResendInvite,
  useTenantBranding,
} from '@/hooks/useTenants';
import { useToast } from '@/hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateModules, useUpdateFeatures } from '@/hooks/useModuleConfig';
import Link from 'next/link';
import { CompanyHeader } from '@/components/organisms/shared/CompanyHeader';
import { CompanyInfoCard } from '@/components/organisms/shared/CompanyInfoCard';
import { ModuleConfiguration, Module } from '@/components/organisms/shared/ModuleConfiguration';
import { ReinsuranceAccountingIntegrationControl } from '@/components/organisms/shared/ReinsuranceAccountingIntegrationControl';
import { TenantAuditTable } from '@/components/organisms/superadmin/TenantAuditTable';
import { EditCompanyPanel } from '@/components/organisms/superadmin/EditCompanyPanel';
import { EditAdminPanel } from '@/components/organisms/superadmin/EditAdminPanel';
import { DEFAULT_MODULES } from '@/lib/ModuleDefaults';
import { Icons } from '@/components/atoms/icons';

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [editAdminOpen, setEditAdminOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'information' | 'activities'>('information');

  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useTenant(id);
  const { data: users = [] } = useTenantUsers(id);
  const { data: auditData } = useTenantAudit(id);
  const { data: branding } = useTenantBranding(id);

  const queryClient = useQueryClient();
  const updateModules = useUpdateModules(id);
  const updateFeatures = useUpdateFeatures(id);
  const { mutate: resendInvite, isPending: isResendingInvite } = useResendInvite();
  const toast = useToast();

  const admin = (
    users as {
      id?: string;
      _id?: string;
      role: string;
      firstName: string;
      lastName: string;
      status: string;
      email: string;
    }[]
  )
    .map((u) => ({ ...u, id: u.id ?? u._id ?? '' }))
    .find((u) => u.role === 'TENANT_ADMIN');

  const moduleConfig = (tenant?.moduleConfig as Record<string, boolean>) ?? {};
  const featureConfig = (tenant?.featureConfig as Record<string, Record<string, boolean>>) ?? {};

  const modules: Module[] = useMemo(
    () =>
      DEFAULT_MODULES.map((m) => ({
        ...m,
        enabled: moduleConfig[m.key] ?? false,
        options: m.options?.map((o) => ({
          ...o,
          enabled: featureConfig[m.key]?.[o.key] ?? false,
        })),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(moduleConfig), JSON.stringify(featureConfig)],
  );

  const auditLogs = auditData?.logs ?? [];

  if (tenantLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-500">
          {tenantError ? 'Failed to load company. Please try again.' : 'Company not found.'}
        </p>
        <Link href="/dashboard" className="text-sm text-brand hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <main className="flex-1 min-h-0 overflow-hidden w-full max-w-7xl mx-auto px-6 py-6 flex flex-col gap-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
        <Link href="/dashboard" className="hover:text-gray-700 transition-colors">
          Dashboard
        </Link>
        <Icons.ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">{tenant.name}</span>
      </nav>

      <CompanyHeader
        id={tenant.id}
        name={tenant.name}
        slug={tenant.slug}
        status={tenant.status}
        onResendInvite={
          admin && ['PENDING', 'PENDING_VERIFICATION'].includes(admin.status)
            ? () =>
                resendInvite(id, {
                  onSuccess: () => toast.success('Invite resent successfully'),
                  onError: () => toast.error('Failed to resend invite'),
                })
            : undefined
        }
        isResendingInvite={isResendingInvite}
      />

      {/* Tabs */}
      <div className="flex gap-1 shrink-0 border-b border-gray-200">
        {(['information', 'activities'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'information' ? 'Information' : 'Recent Activities'}
          </button>
        ))}
      </div>

      {activeTab === 'information' && (
        <div className="grid grid-cols-[2fr_2fr] gap-5 flex-1 min-h-0">
          <CompanyInfoCard
            id={tenant.id}
            name={tenant.name}
            slug={tenant.slug}
            size={tenant.size}
            industry={tenant.industry}
            location={tenant.country}
            address={tenant.address}
            contact={tenant.phone}
            logoUrl={branding?.appLogo.readUrl ?? undefined}
            admin={
              admin
                ? {
                    name: `${admin.firstName} ${admin.lastName}`,
                    status: admin.status,
                    email: admin.email,
                  }
                : undefined
            }
            onEditCompany={() => setEditCompanyOpen(true)}
            onEditAdmin={() => setEditAdminOpen(true)}
            onResendInvite={
              admin && ['PENDING', 'PENDING_VERIFICATION'].includes(admin.status)
                ? () =>
                    resendInvite(id, {
                      onSuccess: () => toast.success('Invite resent successfully'),
                      onError: () => toast.error('Failed to resend invite'),
                    })
                : undefined
            }
            isResendingInvite={isResendingInvite}
          />
          <ModuleConfiguration
            modules={modules}
            onToggle={(moduleId, enabled) => {
              updateModules.mutate({ [moduleId]: enabled });
            }}
            onSave={(updatedModules) => {
              updatedModules.forEach((m) => {
                if (m.options && m.enabled) {
                  const features = Object.fromEntries(
                    m.options.map((o) => [
                      o.key,
                      (o as { key: string; enabled?: boolean }).enabled ?? false,
                    ]),
                  );
                  updateFeatures.mutate({ module: m.key, features });
                }
              });
            }}
          />
          <div className="col-span-2">
            <ReinsuranceAccountingIntegrationControl tenantId={tenant.id} canManage />
          </div>
        </div>
      )}

      {activeTab === 'activities' && (
        <div className="flex-1 min-h-0">
          <TenantAuditTable logs={auditLogs} />
        </div>
      )}

      <EditCompanyPanel
        isOpen={editCompanyOpen}
        onClose={() => setEditCompanyOpen(false)}
        tenant={{
          id: tenant.id,
          name: tenant.name,
          size: tenant.size,
          industry: tenant.industry,
          country: tenant.country,
          address: tenant.address,
          phone: tenant.phone,
        }}
      />

      <EditAdminPanel
        isOpen={editAdminOpen}
        onClose={() => setEditAdminOpen(false)}
        tenantId={tenant.id}
        admin={
          admin ? { name: `${admin.firstName} ${admin.lastName}`, email: admin.email } : undefined
        }
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tenant-users', id] })}
      />
    </main>
  );
}
