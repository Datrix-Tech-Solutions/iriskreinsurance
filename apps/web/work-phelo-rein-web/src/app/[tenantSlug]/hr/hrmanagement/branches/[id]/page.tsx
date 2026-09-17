'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { useBranches } from '@/hooks/hr/useBranches';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { BranchOverview } from '@/components/molecules/hr/branches/BranchOverview';
import { BranchMembersTable } from '@/components/organisms/hr/branches/BranchMembersTable';
import { BranchAssetsTab } from '@/components/organisms/hr/branches/BranchAssetsTab';
import { BranchFormPanel } from '@/components/organisms/hr/branches/BranchFormPanel';

type BranchTab = 'members' | 'department' | 'assets';

const TABS = [
  { key: 'members', label: 'Members' },
  { key: 'department', label: 'Department' },
  { key: 'assets', label: 'Assets' },
];

export default function BranchDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);

  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BranchTab>('members');

  const canUpdate = usePermission(Permission.UPDATE_BRANCH);

  const { data: branches = [], isLoading } = useBranches();
  const { data: employeeOptions = [] } = useEmployeeOptions();

  const branch = branches.find((b) => b.id === id) ?? null;

  const managerName = (() => {
    if (!branch?.managerId) return undefined;
    const mgr = employeeOptions.find((e) => e.id === branch.managerId);
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : undefined;
  })();

  const branchesBase = `/${tenantSlug}/hr/hrmanagement/branches`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={branchesBase} className="hover:text-gray-700 transition-colors">
            Branches
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{branch?.name ?? '—'}</span>
        </nav>

        {canUpdate && branch && (
          <Button size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : !branch ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Branch not found.
        </div>
      ) : (
        <>
          <BranchOverview branch={branch} managerName={managerName} />

          <div className="flex flex-col">
            <TabBar
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={(t) => setActiveTab(t as BranchTab)}
            />

            <div className="pt-5">
              {activeTab === 'members' && <BranchMembersTable branch={branch} />}

              {activeTab === 'department' && (
                <div className="flex items-center justify-center h-40 text-sm text-gray-400"></div>
              )}

              {activeTab === 'assets' && <BranchAssetsTab branchId={branch.id} />}
            </div>
          </div>
        </>
      )}

      {canUpdate && (
        <BranchFormPanel
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          branch={editOpen ? branch : null}
          employees={employeeOptions}
        />
      )}
    </div>
  );
}
