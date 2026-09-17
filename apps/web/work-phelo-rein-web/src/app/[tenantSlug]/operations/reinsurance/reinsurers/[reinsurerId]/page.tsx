'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useReinsurers, useFacultatives, useCurrencies, useFacultativePlacement } from '@/hooks';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { EditReinsurancePanel } from '@/components/organisms/reinsurance/panels/EditReinsurancePanel';
import { ReinsurerOverview } from '@/components/molecules/reinsurance/stats/ReinsurerOverview';
import { CedantContactsTab } from '@/components/molecules/reinsurance/tabs/CedantContactsTab';
import { ReinsurerPlacementsTab } from '@/components/molecules/reinsurance/ReinsurerPlacementsTab';
import { ReinsurerRevenueTab } from '@/components/molecules/reinsurance/tabs/ReinsurerRevenueTab';
import { ReinsurerPremiumsTab } from '@/components/molecules/reinsurance/tabs/ReinsurerPremiumsTab';
import { ReinsurerRecoveriesTab } from '@/components/molecules/reinsurance/tabs/ReinsurerRecoveriesTab';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { FacultativeOverview } from '@/components/molecules/reinsurance/stats/FacultativeOverview';
import { DistributionListTab } from '@/components/molecules/reinsurance/tabs/DistributionListTab';
import { PlacementClosingsTab } from '@/components/molecules/reinsurance/tabs/PlacementClosingsTab';
import { EndorsementTab } from '@/components/molecules/reinsurance/tabs/EndorsmentTab';
import { type ReinsurerParticipation } from '@/components/molecules/reinsurance/tables/ReinsurerPoliciesTable';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

type ReinsurerTab = 'placements' | 'revenue' | 'premiums' | 'recoveries' | 'contacts';
type FacultativeTab = 'distribution' | 'closings' | 'endorsement';

type ActiveView = { placementId: string; reference: string } | null;

const TABS = [
  { key: 'placements', label: 'Placements' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'premiums', label: 'Premiums' },
  { key: 'recoveries', label: 'Recoveries' },
  { key: 'contacts', label: 'Contacts' },
];

const FACULTATIVE_TABS = [
  { key: 'distribution', label: 'Distribution List' },
  { key: 'closings', label: 'Placement Closings' },
  { key: 'endorsement', label: 'Endorsement' },
];

function PlacementView({ placementId }: { placementId: string }) {
  const { data: placement, isLoading } = useFacultativePlacement(placementId);
  const [activeTab, setActiveTab] = useState<FacultativeTab>('distribution');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
    );
  }

  if (!placement) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        Placement not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FacultativeOverview placement={placement} />
      <div className="flex flex-col">
        <TabBar
          tabs={FACULTATIVE_TABS}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as FacultativeTab)}
        />
        <div className="pt-5">
          {activeTab === 'distribution' && <DistributionListTab placement={placement} />}
          {activeTab === 'closings' && <PlacementClosingsTab placement={placement} />}
          {activeTab === 'endorsement' && <EndorsementTab placement={placement} />}
        </div>
      </div>
    </div>
  );
}

export default function ReinsurerDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; reinsurerId: string }>;
}) {
  const { tenantSlug, reinsurerId } = use(params);
  const canView = usePermissionRule('operations.reinsurance.counterparties:VIEW');
  const canEdit = usePermissionRule('operations.reinsurance.counterparties:EDIT');
  const { data: reinsurers = [], isLoading: reinsurersLoading } = useReinsurers();
  const { data: placements = [], isLoading: placementsLoading } = useFacultatives();
  const { data: currencies = [] } = useCurrencies();

  const reinsurer = reinsurers.find((r) => r.id === reinsurerId) ?? null;

  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ReinsurerTab>('placements');
  const [activeView, setActiveView] = useState<ActiveView>(null);

  const settingsBase = `/${tenantSlug}/operations/reinsurance/reinsurers`;

  const participations = useMemo<ReinsurerParticipation[]>(() => {
    return placements.flatMap((p) => {
      const participant = p.participants.find((pt) => pt.counterpartyId === reinsurerId);
      if (!participant) return [];
      return [
        {
          id: p.id,
          reference: displayPolicyNumber(p.policyNumber),
          title: p.title,
          cedant: p.cedant.name,
          role: participant.role,
          sharePercent: participant.sharePercent,
          participantStatus: participant.status,
          placementStatus: p.status,
          offerType: 'Facultative',
          inceptionDate: p.inceptionDate,
          expiryDate: p.expiryDate,
        },
      ];
    });
  }, [placements, reinsurerId]);

  const acceptanceRate = useMemo(() => {
    const accepted = participations.filter((p) => p.participantStatus === 'ACCEPTED').length;
    const declined = participations.filter((p) => p.participantStatus === 'DECLINED').length;
    const decided = accepted + declined;
    return decided > 0 ? Math.round((accepted / decided) * 100) : null;
  }, [participations]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={settingsBase} className="hover:text-gray-700 transition-colors">
            Reinsurers
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          {activeView ? (
            <>
              <button
                onClick={() => setActiveView(null)}
                className="hover:text-gray-700 transition-colors"
              >
                {reinsurer?.name ?? '—'}
              </button>
              <Icons.ChevronRight className="w-5 h-5" />
              <span className="text-gray-700 font-medium">{activeView.reference}</span>
            </>
          ) : (
            <span className="text-gray-700 font-medium">{reinsurer?.name ?? '—'}</span>
          )}
        </nav>
        {!activeView && reinsurer && canView && canEdit && (
          <Button size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        )}
      </div>

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        {reinsurersLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        ) : !canView ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            You don&apos;t have permission to view this reinsurer.
          </div>
        ) : !reinsurer ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Reinsurer not found.
          </div>
        ) : activeView ? (
          <PlacementView placementId={activeView.placementId} />
        ) : (
          <div className="flex flex-col gap-6">
            <ReinsurerOverview
              reinsurer={reinsurer}
              headerExtra={
                acceptanceRate !== null ? (
                  <>
                    <span className="text-sm text-gray-400">|</span>
                    <span className="text-sm text-gray-400">
                      Acceptance Rate{' '}
                      <span className="font-bold text-gray-900">{acceptanceRate}%</span>
                    </span>
                  </>
                ) : undefined
              }
            />

            <div className="flex flex-col">
              <TabBar
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={(t) => setActiveTab(t as ReinsurerTab)}
              />

              <div className="pt-5">
                {activeTab === 'contacts' && <CedantContactsTab counterparty={reinsurer} />}

                {activeTab === 'placements' && (
                  <ReinsurerPlacementsTab
                    participations={participations}
                    isLoading={placementsLoading}
                    onView={(id, reference) => setActiveView({ placementId: id, reference })}
                    // onView={(id) =>
                    //   router.push(`/${tenantSlug}/operations/reinsurance/facultative/${id}`)
                    // }
                  />
                )}

                {activeTab === 'revenue' && (
                  <ReinsurerRevenueTab
                    placements={placements}
                    reinsurerId={reinsurerId}
                    reinsurer={reinsurer}
                    reinsurerDefaultBrokerageFee={reinsurer.brokerageFee}
                    currencies={currencies}
                  />
                )}

                {activeTab === 'premiums' && <ReinsurerPremiumsTab />}

                {activeTab === 'recoveries' && (
                  <ReinsurerRecoveriesTab placements={placements} reinsurerId={reinsurerId} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <EditReinsurancePanel
        reinsurer={editOpen ? reinsurer : null}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
