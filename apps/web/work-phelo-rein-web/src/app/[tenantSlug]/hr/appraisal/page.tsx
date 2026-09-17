'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { useTeamAppraisals } from '@/hooks';
import { Permission } from '@/lib/permissionMap';

/**
 * Appraisal no longer has its own tabbed page — HR/Admin review and Team
 * Review are now their own pages with their own sidebar entries
 * (appraisal/layout.tsx). "My Appraisal" moved to the Profile page instead,
 * since it's personal/self-service rather than appraisal management. This
 * root just sends the viewer to whichever management page they actually
 * have access to.
 */
export default function AppraisalPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const canCreateAppraisal = usePermission(Permission.CREATE_APPRAISAL);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canApproveAppraisal = usePermission(Permission.FINALIZE_APPRAISAL);
  const canViewAppraisals = canCreateAppraisal || canConfigureAppraisal || canApproveAppraisal;

  const { data: teamData } = useTeamAppraisals();
  const isManager = (teamData?.length ?? 0) > 0;

  useEffect(() => {
    if (user === null) return;
    if (!user.featureConfig?.hr?.appraisal) {
      router.replace(`/${tenantSlug}/hr`);
      return;
    }
    const base = `/${tenantSlug}/hr/appraisal`;
    if (canViewAppraisals) router.replace(`${base}/hr-review`);
    else if (isManager) router.replace(`${base}/team`);
    else router.replace(`/${tenantSlug}/hr`);
  }, [user, tenantSlug, canViewAppraisals, isManager, router]);

  return null;
}
