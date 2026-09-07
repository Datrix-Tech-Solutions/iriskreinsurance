'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { AssetsContent } from '@/components/organisms/hr/assets/AssetsContent';

export default function AssetsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canReadAssets = usePermission(Permission.READ_ASSETS);
  const canManageAssets = usePermission(Permission.MANAGE_ASSETS);
  const canAssignAsset = usePermission(Permission.ASSIGN_ASSET);
  const canAccessAssets = canReadAssets || canManageAssets || canAssignAsset;

  useEffect(() => {
    if (canAccessAssets === false) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [canAccessAssets, tenantSlug, router]);

  if (!canAccessAssets) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <AssetsContent />
    </div>
  );
}
