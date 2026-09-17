'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnnouncementsContent } from '@/components/organisms/hr/announcements/AnnouncementsContent';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';

export default function AnnouncementsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canManageAnnouncements = usePermission(Permission.MANAGE_ANNOUNCEMENTS);

  useEffect(() => {
    if (canManageAnnouncements === false) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [canManageAnnouncements, router, tenantSlug]);

  if (!canManageAnnouncements) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <AnnouncementsContent />
    </div>
  );
}
