'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { LeaveRequestsTab } from '@/components/organisms/hr/leave/LeaveRequestsTab';
import { pageHeader, pageContent } from '@/lib/layout';

export default function LeaveRequestsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.user?.role === 'TENANT_ADMIN');
  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canReview = canApproveLeave || isAdmin;

  useEffect(() => {
    if (canApproveLeave === false && !isAdmin) {
      router.replace(`/${tenantSlug}/hr/leave`);
    }
  }, [canApproveLeave, isAdmin, tenantSlug, router]);

  if (!canReview) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Leave Requests</h1>
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        <LeaveRequestsTab tenantSlug={tenantSlug} canReview={canReview} />
      </div>
    </div>
  );
}
