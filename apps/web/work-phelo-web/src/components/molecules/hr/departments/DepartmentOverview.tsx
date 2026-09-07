'use client';

import { DetailField } from '@/components/atoms/DetailField';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { Badge } from '@/components/atoms/Badge';
import type { Department } from '@/types/hr';

interface DepartmentOverviewProps {
  department: Department;
  managerName?: string;
}

export function DepartmentOverview({ department, managerName }: DepartmentOverviewProps) {
  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Name" value={department.name} />
        <DetailField label="Department Head" value={managerName ?? '—'} />
        <DetailField label="Members" value={department._count?.employees ?? 0} />
        <DetailField
          label="Status"
          value={
            <Badge
              variant={department.isActive ? 'success' : 'neutral'}
              label={department.isActive ? 'Active' : 'Inactive'}
            />
          }
        />
        {department.description && (
          <DetailField label="Description" value={department.description} />
        )}
      </div>
    </CollapsibleOverview>
  );
}
