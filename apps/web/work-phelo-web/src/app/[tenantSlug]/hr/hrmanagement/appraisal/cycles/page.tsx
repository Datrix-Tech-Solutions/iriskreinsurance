'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { AppraisalCyclesList } from '@/components/organisms/hr/appraisal/AppraisalCyclesList';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';

export default function AppraisalCyclesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canConfigureAppraisal } = useHrManagementAccess();

  useEffect(() => {
    if (user !== null && !canConfigureAppraisal) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [canConfigureAppraisal, router, tenantSlug, user]);

  if (user !== null && !canConfigureAppraisal) {
    return null;
  }

  return (
    <div className="p-0 flex flex-col gap-6">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Appraisal Cycles</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Schedule and manage performance review cycles across departments
        </p>
      </div>
      <AppraisalCyclesList tenantSlug={tenantSlug} />
    </div>
  );
}
