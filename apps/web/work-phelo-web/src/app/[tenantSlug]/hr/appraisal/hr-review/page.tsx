'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { HRAppraisalsTable } from '@/components/organisms/hr/appraisal/HRAppraisalTable';
import { pageHeader, pageContent } from '@/lib/layout';

export default function HrReviewPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canCreateAppraisal = usePermission(Permission.CREATE_APPRAISAL);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canApproveAppraisal = usePermission(Permission.FINALIZE_APPRAISAL);
  const canViewAppraisals = canCreateAppraisal || canConfigureAppraisal || canApproveAppraisal;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (canViewAppraisals === false) {
      router.replace(`/${tenantSlug}/hr/appraisal`);
    }
  }, [canViewAppraisals, tenantSlug, router]);

  if (!canViewAppraisals) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">HR Review</h1>
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        <HRAppraisalsTable search={search} onSearch={setSearch} page={page} onPageChange={setPage} />
      </div>
    </div>
  );
}
