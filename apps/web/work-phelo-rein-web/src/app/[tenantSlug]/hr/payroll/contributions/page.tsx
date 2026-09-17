'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { usePayrollSettings } from '@/hooks';
import { getPayrollLabels } from '@/lib/payrollDisplay';
import { SSNITTab } from '@/components/organisms/hr/payroll/SSNITTab';
import { PensionTab_NG } from '@/components/organisms/hr/payroll/PensionTab_NG';
import { NSSFTab_KE } from '@/components/organisms/hr/payroll/NSSFTab_KE';
import { pageHeader, pageContent } from '@/lib/layout';

export default function PayrollContributionsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  const { data: payrollSettings } = usePayrollSettings();
  const payrollCountry = payrollSettings?.payrollCountry ?? 'GH';
  const label = getPayrollLabels(payrollCountry).tabLabel;

  useEffect(() => {
    if (canManagePayroll === false) {
      router.replace(`/${tenantSlug}/hr/payroll`);
    }
  }, [canManagePayroll, tenantSlug, router]);

  if (!canManagePayroll) return null;

  function renderContributionsTab() {
    if (payrollCountry === 'NG') return <PensionTab_NG />;
    if (payrollCountry === 'KE') return <NSSFTab_KE />;
    return <SSNITTab />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">{label}</h1>
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        {renderContributionsTab()}
      </div>
    </div>
  );
}
