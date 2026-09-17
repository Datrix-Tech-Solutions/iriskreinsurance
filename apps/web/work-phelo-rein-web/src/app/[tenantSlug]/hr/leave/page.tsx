'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';

/**
 * Leave no longer has its own tabbed page — Leave Requests and the config
 * pages (Leave Types, Public Holidays) are each their own page with their own
 * sidebar entry (leave/layout.tsx). "My Leave" moved to the Profile page
 * instead, since it's personal/self-service. This root just sends the viewer
 * to whichever management page they actually have access to.
 */
export default function LeavePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'TENANT_ADMIN';
  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canManageLeaveTypes = usePermission(Permission.MANAGE_LEAVE_TYPES);

  useEffect(() => {
    if (user === null) return;
    const base = `/${tenantSlug}/hr/leave`;
    if (canApproveLeave || isAdmin) router.replace(`${base}/requests`);
    else if (canManageLeaveTypes) router.replace(`${base}/settings/types`);
    else router.replace(`/${tenantSlug}/hr`);
  }, [user, tenantSlug, isAdmin, canApproveLeave, canManageLeaveTypes, router]);

  return null;
}
