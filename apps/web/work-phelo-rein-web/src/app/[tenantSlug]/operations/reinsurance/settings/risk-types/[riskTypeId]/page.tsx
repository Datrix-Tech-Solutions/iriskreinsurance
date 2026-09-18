'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useRiskTypes, useRiskClassOptions, useFacultativesPage } from '@/hooks';
import { EditRiskTypePanel } from '@/components/organisms/reinsurance/panels/EditRiskTypePanel';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { RiskTypeOverview } from '@/components/molecules/reinsurance/stats/RiskTypeOverview';
import { RiskTypePoliciesSection } from '@/components/molecules/reinsurance/RiskTypePoliciesSection';

export default function RiskTypeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; riskTypeId: string }>;
}) {
  const { tenantSlug, riskTypeId } = use(params);

  const { data: riskTypes = [], isLoading: riskTypesLoading } = useRiskTypes();
  const { data: classOptions = [] } = useRiskClassOptions();
  const [policiesPage, setPoliciesPage] = useState(1);
  const { data: policiesResponse, isLoading: placementsLoading } = useFacultativesPage({
    page: policiesPage,
    limit: 10,
    riskTypeId,
    archived: false,
  });

  const riskType = riskTypes.find((rt) => rt.id === riskTypeId) ?? null;
  const riskClassName = classOptions.find((o) => o.value === riskType?.riskClassId)?.label ?? '—';

  const [editOpen, setEditOpen] = useState(false);
  const canEdit = usePermissionRule('operations.reinsurance.settings:EDIT');

  const settingsBase = `/${tenantSlug}/operations/reinsurance/settings/risk-types`;

  const policies = policiesResponse?.items ?? [];
  const policyTotalPages = Math.max(1, policiesResponse?.meta.totalPages ?? 1);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={settingsBase} className="hover:text-gray-700 transition-colors">
            Risk Types
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{riskType?.name ?? '—'}</span>
        </nav>
        {riskType && canEdit && (
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Icons.Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        {riskTypesLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        ) : !riskType ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Risk type not found.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <RiskTypeOverview riskType={riskType} riskClassName={riskClassName} />

            <RiskTypePoliciesSection
              policies={policies}
              isLoading={placementsLoading}
              tenantSlug={tenantSlug}
              currentPage={policiesPage}
              totalPages={policyTotalPages}
              onPageChange={setPoliciesPage}
            />
          </div>
        )}
      </div>

      <EditRiskTypePanel riskType={editOpen ? riskType : null} onClose={() => setEditOpen(false)} />
    </div>
  );
}
