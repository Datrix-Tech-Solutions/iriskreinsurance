'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RolesContent } from '@/components/organisms/roles/RolesContent';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';

export default function RolesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canAccessRoles } = useHrManagementAccess();

  useEffect(() => {
    if (user !== null && !canAccessRoles) {
      router.replace(`/${user.tenantSlug}/hr`);
    }
  }, [canAccessRoles, router, user]);

  if (user !== null && !canAccessRoles) {
    return null;
  }

  return <RolesContent />;
}
