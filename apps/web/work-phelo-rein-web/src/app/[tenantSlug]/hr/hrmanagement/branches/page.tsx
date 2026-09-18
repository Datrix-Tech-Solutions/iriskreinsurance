'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { BranchesTable } from '@/components/organisms/hr/branches/BranchesTable';

export default function BranchesPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const user = useAuthStore((s) => s.user);
  const { canReadBranches } = useHrManagementAccess();

  useEffect(() => {
    if (user !== null && !canReadBranches) {
      router.replace(`/${params.tenantSlug}/hr`);
    }
  }, [canReadBranches, router, user, params.tenantSlug]);

  if (user !== null && !canReadBranches) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Branches</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage company branches and their details</p>
      </div>
      <BranchesTable />
    </div>
  );
}
