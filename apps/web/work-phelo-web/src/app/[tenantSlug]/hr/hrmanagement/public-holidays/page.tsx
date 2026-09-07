'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { PublicHolidaysList } from '@/components/organisms/hr/leave/PublicHolidaysList';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';

export default function PublicHolidaysPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canManageLeaveTypes } = useHrManagementAccess();

  useEffect(() => {
    if (user !== null && !canManageLeaveTypes) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [canManageLeaveTypes, router, tenantSlug, user]);

  if (user !== null && !canManageLeaveTypes) {
    return null;
  }

  return (
    <div className="p-0 flex flex-col gap-6">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Public Holidays</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage public holidays — these days are automatically excluded from leave calculations
        </p>
      </div>
      <PublicHolidaysList tenantSlug={tenantSlug} />
    </div>
  );
}
