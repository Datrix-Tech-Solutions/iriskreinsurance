// MODULES

'use client';

import { use } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useModuleTransition } from '@/hooks';
import { ModuleButton } from '@/components/molecules/ModuleButton';
import { getGreeting } from '@/lib/formatters';
import { ModuleIcons, MODULE_COLORS } from '@/components/atoms/icons';
import { AgreementGate } from '@/components/organisms/hr/companyPolicies/AgreementGate';

/* ── Module definitions ── */
interface ModuleDef {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  route: string;
}

const MODULE_DEFS: ModuleDef[] = [
  {
    key: 'hr',
    name: 'Human Resource',
    description: 'Manage employees, payroll, and attendance',
    icon: <ModuleIcons.hr className="w-7 h-7" />,
    route: 'hr',
  },
  {
    key: 'marketing',
    name: 'Marketing',
    description: 'Manage campaigns, leads, and analytics',
    icon: <ModuleIcons.marketing className="w-7 h-7" />,
    route: 'marketing',
  },
  {
    key: 'accounting',
    name: 'Accounting',
    description: 'Manage invoices, expenses, and reports',
    icon: <ModuleIcons.accounting className="w-7 h-7" />,
    route: 'accounting',
  },
  {
    key: 'recruitment',
    name: 'Recruitment',
    description: 'Manage job postings, applications, and onboarding',
    icon: <ModuleIcons.recruitment className="w-7 h-7" />,
    route: 'recruitment',
  },
  {
    key: 'operations',
    name: 'Operations',
    description: 'Manage operations, workflows, and tasks',
    icon: <ModuleIcons.operations className="w-7 h-7" />,
    route: 'operations',
  },
];

/* ── Page ── */
export default function ModulesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const { navigateToModule } = useModuleTransition();
  const user = useAuthStore((s) => s.user);

  const firstName = user?.firstName ?? 'User';
  const tenantName = user?.tenantName ?? '';
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  /* ── Enabled modules from tenant config ── */
  const moduleConfig = user?.moduleConfig ?? {};
  const enabledKeys = new Set(
    Object.entries(moduleConfig)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key),
  );

  return (
    <>
      {isEmployee && <AgreementGate />}

      <main className="flex-1 min-h-0 overflow-y-auto">
        {/* Welcome banner */}
        <div className="bg-transparent mx-3 mt-3 sm:mx-6 sm:mt-6 rounded-card px-4 sm:px-8 py-4 sm:py-6 flex flex-wrap items-center gap-4 justify-between">
          <div>
            {!isTenantAdmin && <p className="text-l font-medium text-brand mb-1">{tenantName}</p>}
            <h1 className="text-2xl font-bold text-gray-800">
              {getGreeting()}, {isTenantAdmin ? tenantName : firstName}
            </h1>
          </div>
        </div>

        {/* Modules section */}
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col items-center gap-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">Your Modules</h2>
            <p className="text-sm text-gray-400 mt-1">Click on a module to get started</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
            {MODULE_DEFS.map((mod) => {
              const enabled = enabledKeys.has(mod.key);
              return (
                <ModuleButton
                  key={mod.key}
                  name={mod.name}
                  description={mod.description}
                  icon={mod.icon}
                  iconBg={MODULE_COLORS[mod.key]}
                  enabled={enabled}
                  onClick={() =>
                    navigateToModule({
                      moduleKey: mod.key,
                      moduleName: mod.name,
                      path: `/${tenantSlug}/${mod.route}`,
                    })
                  }
                />
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
