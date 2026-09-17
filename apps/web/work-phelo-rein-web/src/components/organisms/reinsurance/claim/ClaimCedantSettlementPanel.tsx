'use client';

import { useMemo } from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { useClaimAllocations, useClaimRecoveryPosition } from '@/hooks';
import { cardClass } from '@/lib/utils';
import { fmt } from '@/lib/reinsurance/claimFormat';
import { PlacementClaim } from '@/types/reinsurance';

interface ClaimCedantSettlementPanelProps {
  placementId: string;
  claim: PlacementClaim;
}

export function ClaimCedantSettlementPanel({
  placementId,
  claim,
}: ClaimCedantSettlementPanelProps) {
  const { data: position } = useClaimRecoveryPosition(placementId, claim.id);
  const { data: allocations = [] } = useClaimAllocations(placementId, claim.id);

  const finalLossAmount = position?.claim.finalLossAmount ?? claim.finalLossAmount;

  const payableClaim = useMemo(
    () =>
      allocations.reduce(
        (sum, a) => sum + parseFloat(a.allocatedFinalLossAmount ?? a.allocatedEstimatedLossAmount),
        0,
      ),
    [allocations],
  );

  if (!finalLossAmount) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        100% Claim Amount not recorded, edit claim to add the claim amount.
      </div>
    );
  }

  const actualClaim = parseFloat(finalLossAmount);
  const totalConfirmed = parseFloat(position?.recoveries.totalConfirmed ?? '0');
  const totalReversed = parseFloat(position?.recoveries.totalReversed ?? '0');
  const recoveredClaim = totalConfirmed - totalReversed;
  const outstanding = Math.max(0, payableClaim - recoveredClaim);
  const isFullyRecovered = payableClaim > 0 && outstanding <= 0.01;

  return (
    <div className={cardClass('p-6 w-full flex flex-col gap-2')}>
      <span className="text-sm font-bold text-gray-900">Cedant Claim Settlement</span>
      <DetailField horizontal label="100% Claim Amount" value={fmt(actualClaim, claim.currency)} />
      <DetailField horizontal label="Claim Share" value={fmt(payableClaim, claim.currency)} />
      <DetailField
        horizontal
        label="Recovered Claim share"
        value={fmt(recoveredClaim, claim.currency)}
      />
      <DetailField
        horizontal
        label="Outstanding Claim Share"
        value={
          <span className={isFullyRecovered ? 'text-green-600 font-semibold' : undefined}>
            {isFullyRecovered ? 'Fully Recovered' : fmt(outstanding, claim.currency)}
          </span>
        }
      />
    </div>
  );
}
