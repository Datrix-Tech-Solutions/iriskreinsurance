'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { AuditLogsTable } from '@/components/organisms/hrmanagement/AuditLogsTable';

export default function AuditLogsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canViewAuditLogs } = useHrManagementAccess();

  useEffect(() => {
    if (user !== null && !canViewAuditLogs) {
      router.replace(`/${user.tenantSlug}/hr`);
    }
  }, [canViewAuditLogs, router, user]);

  if (user !== null && !canViewAuditLogs) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Audit</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage company audit logs and their details</p>
      </div>
      <AuditLogsTable />
    </div>
  );
}
