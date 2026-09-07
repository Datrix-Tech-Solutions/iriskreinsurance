// ADMIN APRAISAL PAGE //

'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useTeamAppraisals } from '@/hooks';
import { cn } from '@/lib/utils';
import { pageHeader, pagePx, pageContent } from '@/lib/layout';
import { AppraisalTabs } from '@/components/molecules/hr/appraisal/AppraisalTabs';
import { MyAppraisalsTable } from '@/components/organisms/hr/appraisal/MyAppraisalTable';
import { TeamReviewTable } from '@/components/organisms/hr/appraisal/TeamReviewTable';
import { HRAppraisalsTable } from '@/components/organisms/hr/appraisal/HRAppraisalTable';

export default function AppraisalPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user !== null && !user.featureConfig?.hr?.appraisal) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [user, tenantSlug, router]);
  const hasHRProfile = user?.role === 'EMPLOYEE';

  const canCreateAppraisal = usePermission(Permission.CREATE_APPRAISAL);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canApproveAppraisal = usePermission(Permission.FINALIZE_APPRAISAL);
  const canViewAppraisals = canCreateAppraisal || canConfigureAppraisal || canApproveAppraisal;

  const { data: teamData } = useTeamAppraisals();
  const isManager = (teamData?.length ?? 0) > 0;
  const teamUnreviewedCount =
    teamData?.filter((r) => r.overallStatus === 'SelfSubmitted').length ?? 0;

  // TENANT_ADMIN defaults to the Appraisals tab; employees default to My Appraisal.
  const [activeTab, setActiveTab] = useState<'my' | 'team' | 'hr'>(() => {
    const role = useAuthStore.getState().user?.role;
    return role === 'TENANT_ADMIN' ? 'hr' : 'my';
  });
  const [mySearch, setMySearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [hrSearch, setHrSearch] = useState('');
  const [myPage, setMyPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);
  const [hrPage, setHrPage] = useState(1);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-bold text-gray-900">Appraisal Management</h1>
        </div>
        <AppraisalTabs
          activeTab={activeTab}
          isEmployee={hasHRProfile}
          canReviewTeam={isManager}
          canViewAppraisals={canViewAppraisals}
          teamUnreviewedCount={teamUnreviewedCount}
          onTabChange={setActiveTab}
          className={pagePx}
        />
      </div>

      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col')}>
        {activeTab === 'my' && hasHRProfile && (
          <MyAppraisalsTable
            search={mySearch}
            onSearch={setMySearch}
            page={myPage}
            onPageChange={setMyPage}
          />
        )}

        {activeTab === 'team' && isManager && (
          <TeamReviewTable
            search={teamSearch}
            onSearch={setTeamSearch}
            page={teamPage}
            onPageChange={setTeamPage}
          />
        )}

        {activeTab === 'hr' && canViewAppraisals && (
          <HRAppraisalsTable
            search={hrSearch}
            onSearch={setHrSearch}
            page={hrPage}
            onPageChange={setHrPage}
          />
        )}
      </div>
    </div>
  );
}
