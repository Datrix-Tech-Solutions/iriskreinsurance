'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { ApprovePayrollTab } from '@/components/organisms/hr/payroll/ApprovePayrollTab';
import { pageHeader, pageContent } from '@/lib/layout';

export default function ApprovePayrollPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);

  useEffect(() => {
    if (canApprovePayroll === false) {
      router.replace(`/${tenantSlug}/hr/payroll`);
    }
  }, [canApprovePayroll, tenantSlug, router]);

  if (!canApprovePayroll) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Approve Payroll</h1>
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        <ApprovePayrollTab />
      </div>
    </div>
  );
}
