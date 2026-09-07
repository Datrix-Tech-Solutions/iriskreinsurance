'use client';

import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { Badge } from '@/components/atoms/Badge';
import { ClaimDetailsPanel } from '@/components/molecules/reinsurance/claim/ClaimDetailsPanel';
import { ClaimStatusActions } from '@/components/organisms/reinsurance/claim/ClaimStatusActions';
import { Facultative, PlacementClaim } from '@/types/reinsurance';
import { useCedants, useClaimTabBucket, ClaimTabBucket } from '@/hooks';
import { isForeignCedant, FOREIGN_CEDANT_DEDUCTION_RATE } from '@/lib/reinsuranceTax';

interface ClaimOverviewProps {
  placement: Facultative;
  claim?: PlacementClaim;
}

const TAB_BUCKET_LABEL: Record<ClaimTabBucket, string> = {
  notification: 'Notification',
  open: 'Open Claim',
  closed: 'Closed Claim',
};

const TAB_BUCKET_VARIANT: Record<ClaimTabBucket, 'neutral' | 'warning' | 'success'> = {
  notification: 'neutral',
  open: 'warning',
  closed: 'success',
};

export function ClaimOverview({ placement, claim }: ClaimOverviewProps) {
  const { data: cedants = [] } = useCedants();
  const deductionRate = isForeignCedant(cedants.find((c) => c.id === placement.cedant.id))
    ? FOREIGN_CEDANT_DEDUCTION_RATE
    : 0;

  const { bucket, recoveredAt } = useClaimTabBucket(placement.id, claim);

  return (
    <CollapsibleOverview
      headerExtra={
        claim && (
          <>
            <span className="text-sm text-gray-500">|</span>
            <Badge label={TAB_BUCKET_LABEL[bucket]} variant={TAB_BUCKET_VARIANT[bucket]} />
          </>
        )
      }
    >
      <ClaimDetailsPanel
        placement={placement}
        claim={claim}
        deductionRate={deductionRate}
        recoveredAt={bucket === 'closed' ? recoveredAt : null}
        statusActions={claim && <ClaimStatusActions placementId={placement.id} claim={claim} />}
      />
    </CollapsibleOverview>
  );
}
