'use client';

import { DetailField } from '@/components/atoms/DetailField';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { BranchStatus, HeadOfficeTag } from '@/components/molecules/hr/branches/BranchStatus';
import type { Branch } from '@/types/hr';

function formatLocation(branch: Branch): string {
  return [branch.city, branch.region, branch.country].filter(Boolean).join(', ') || '—';
}

interface BranchOverviewProps {
  branch: Branch;
  managerName?: string;
}

export function BranchOverview({ branch, managerName }: BranchOverviewProps) {
  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField
          label="Name"
          value={
            <span className="flex flex-col gap-1 items-start">
              {branch.name}
              {branch.isHeadOffice && <HeadOfficeTag />}
            </span>
          }
        />
        {branch.code && <DetailField label="Code" value={branch.code} />}
        <DetailField label="Location" value={formatLocation(branch)} />
        <DetailField label="Branch Manager" value={managerName ?? '—'} />
        <DetailField label="Phone" value={branch.phone ?? '—'} />
        <DetailField label="Email" value={branch.email ?? '—'} />
        <DetailField label="Members" value={branch._count?.employees ?? 0} />
        <DetailField
          label="Status"
          value={<BranchStatus count={branch._count?.employees ?? 0} isActive={branch.isActive} />}
        />
      </div>
    </CollapsibleOverview>
  );
}
