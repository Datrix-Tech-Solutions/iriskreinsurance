'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { useAuthStore } from '@/store/auth.store';
import ReinsuranceFoundation from '@/components/organisms/reinsurance/ReinsuranceFoundation';

export default function ReinsurancePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const authLoading = useAuthStore((state) => state.isLoading);
  const hasAccess = usePermission(Permission.VIEW_REINSURANCE_DASHBOARD);

  useEffect(() => {
    if (!authLoading && !hasAccess) {
      router.replace(`/${tenantSlug}/modules`);
    }
  }, [authLoading, hasAccess, router, tenantSlug]);

  if (authLoading || !hasAccess) return null;

  return <ReinsuranceFoundation />;
}
