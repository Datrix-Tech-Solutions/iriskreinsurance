'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import {
  useFacultativePlacement,
  useForceCloseFacultative,
  usePlacementEndorsements,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { extractError } from '@/lib/extractError';
import { isEffectivelyClosed } from '@/lib/reinsurance/placementStatus';
import { TERMINAL_ENDORSEMENT_STATUSES } from '@/types/reinsurance';
import {
  FacultativeOverview,
  PaymentStatus,
} from '@/components/molecules/reinsurance/stats/FacultativeOverview';
import { DistributionListTab } from '@/components/molecules/reinsurance/tabs/DistributionListTab';
import { PlacementClosingsTab } from '@/components/molecules/reinsurance/tabs/PlacementClosingsTab';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import { EndorsementPanel } from '@/components/organisms/reinsurance/panels/EndorsementPanel';
import { EndorsementTab } from '@/components/molecules/reinsurance/tabs/EndorsmentTab';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

type FacultativeTab = 'distribution' | 'closings' | 'endorsement';

export default function FacultativeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const searchParams = useSearchParams();
  const fromClosing = searchParams.get('from') === 'closing';
  const tabParam = searchParams.get('tab');
  const { data: placement, isLoading } = useFacultativePlacement(id);
  const { data: endorsements = [] } = usePlacementEndorsements(placement?.id ?? '');
  const pendingEndorsementCount = endorsements.filter(
    (e) => !TERMINAL_ENDORSEMENT_STATUSES.includes(e.status),
  ).length;
  const forceClose = useForceCloseFacultative(id);
  const toast = useToast();
  const canEditOffer = useAnyPermissionRules(RiPerm.editOffer);
  const canReopenOffer = useAnyPermissionRules(RiPerm.reopenOffer);
  const canForceCloseOffer = useAnyPermissionRules(RiPerm.forceClose);
  const canEndorseOffer = useAnyPermissionRules(RiPerm.endorseOffer);
  const [activeTab, setActiveTab] = useState<FacultativeTab>(
    tabParam === 'endorsement' ? 'endorsement' : 'distribution',
  );
  const [editOpen, setEditOpen] = useState(false);
  const [endorsementOpen, setEndorsementOpen] = useState(false);
  const [forceCloseOpen, setForceCloseOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Outstanding Payment');
  const canForceClose = placement?.status === 'CLOSING';
  const hasEndorsement = endorsements.some((e) => e.status !== 'VOID');
  const showReopen =
    !!placement &&
    isEffectivelyClosed(placement) &&
    placement.status !== 'DECLINED' &&
    placement.status !== 'CANCELLED';

  const shouldDefaultToClosings = placement?.status === 'CLOSING' || placement?.status === 'CLOSED';

  const [prevShouldDefaultToClosings, setPrevShouldDefaultToClosings] = useState(false);
  if (shouldDefaultToClosings !== prevShouldDefaultToClosings) {
    setPrevShouldDefaultToClosings(shouldDefaultToClosings);
    // Don't clobber an explicit `?tab=endorsement` deep link (e.g. from creating an
    // endorsement on the Facultative list) with the closing-tab default.
    if (shouldDefaultToClosings && tabParam !== 'endorsement') {
      setActiveTab('closings');
    }
  }

  const handleForceClose = async () => {
    try {
      const updated = await forceClose.mutateAsync();
      toast.success(`Placement force closed at ${updated.facultativeOffer ?? 0}% placed capacity.`);
      setForceCloseOpen(false);
    } catch (error) {
      toast.error(extractError(error, 'Failed to force close placement'));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0 flex items-center justify-between`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/operations/reinsurance/facultative${fromClosing ? '?tab=closing' : ''}`}
            className="hover:text-gray-700 transition-colors"
          >
            {fromClosing ? 'Closings' : 'Facultative'}
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">
            {displayPolicyNumber(placement?.policyNumber)}
          </span>
        </nav>
        {placement && (
          <div className="flex items-center gap-2">
            {placement.status === 'CLOSED' && canEndorseOffer && (
              <Button size="sm" variant="primary" onClick={() => setEndorsementOpen(true)}>
                Endorse Policy
              </Button>
            )}
            {paymentStatus === 'Outstanding Payment' &&
              !(showReopen && hasEndorsement) &&
              (showReopen ? canReopenOffer : canEditOffer) && (
                <Button
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  className={
                    showReopen
                      ? 'bg-green-600 border-green-600 hover:bg-green-700 hover:border-green-700 focus:ring-green-600'
                      : ''
                  }
                >
                  {showReopen ? 'Reopen Offer' : 'Edit'}
                </Button>
              )}
            {canForceClose && canForceCloseOffer && (
              <Button size="sm" variant="danger" onClick={() => setForceCloseOpen(true)}>
                Force Close
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        ) : !placement ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Placement not found.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Overview */}
            <FacultativeOverview placement={placement} onPaymentStatusChange={setPaymentStatus} />

            {/* Tabs */}
            <div className="flex flex-col">
              <TabBar
                tabs={[
                  { key: 'distribution', label: 'Distribution List' },
                  { key: 'closings', label: 'Closings' },
                  { key: 'endorsement', label: 'Endorsements', count: pendingEndorsementCount },
                ]}
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
        )}
      </div>

      {placement && (
        <EditFacultativePanel
          isOpen={editOpen}
          placement={placement}
          onClose={() => setEditOpen(false)}
          mode={showReopen ? 'reopen' : 'edit'}
        />
      )}
      {placement && (
        <EndorsementPanel
          isOpen={endorsementOpen}
          placement={placement}
          onClose={() => setEndorsementOpen(false)}
          onCreated={() => setActiveTab('endorsement')}
        />
      )}
      <Modal
        isOpen={forceCloseOpen}
        onClose={() => {
          if (!forceClose.isPending) setForceCloseOpen(false);
        }}
        title="Force Close Placement?"
        description="This will immediately close the placement using the currently confirmed placed percentage. Outstanding workflow will remain incomplete. Proceed?"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setForceCloseOpen(false)}
              disabled={forceClose.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleForceClose}
              isLoading={forceClose.isPending}
              loadingText="Force closing…"
            >
              Force Close
            </Button>
          </>
        }
      />
    </div>
  );
}
