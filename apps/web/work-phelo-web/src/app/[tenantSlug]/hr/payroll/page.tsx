'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';

/**
 * Payroll no longer has its own tabbed page — each former management tab is
 * now its own page with its own sidebar entry (payroll/layout.tsx). "My
 * Payslip" moved to the Profile page instead, since it's personal/self-service
 * rather than payroll management. This root just sends the viewer to
 * whichever management page they actually have access to.
 */
export default function PayrollPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);

  useEffect(() => {
    if (user === null) return;
    const base = `/${tenantSlug}/hr/payroll`;
    if (canManagePayroll) router.replace(`${base}/manage`);
    else if (canApprovePayroll) router.replace(`${base}/approve`);
    else router.replace(`/${tenantSlug}/hr`);
  }, [user, tenantSlug, canManagePayroll, canApprovePayroll, router]);

  return null;
}
