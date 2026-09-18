import { ReactNode, useMemo } from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { fmt, fmtDate } from '@/lib/reinsurance/claimFormat';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import {
  useAllPlacementParticipants,
  useClaimAllocations,
  usePremiumPaymentContext,
} from '@/hooks';
import { Facultative, PlacementClaim } from '@/types/reinsurance';

function fmtFieldValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

interface ClaimDetailsPanelProps {
  placement: Facultative;
  claim?: PlacementClaim;
  deductionRate: number;

  recoveredAt?: string | null;

  statusActions?: ReactNode;
}

export function ClaimDetailsPanel({
  placement,
  claim,
  deductionRate,
  recoveredAt,
  // statusActions,
}: ClaimDetailsPanelProps) {
  const { facultativeOffer, sumInsured, premium, commission, currency, createdAt } = placement;

  const facSumInsured =
    sumInsured != null && facultativeOffer != null ? sumInsured * (facultativeOffer / 100) : null;

  const facPremium =
    premium != null && facultativeOffer != null ? (facultativeOffer / 100) * premium : null;

  const netPremium =
    facPremium != null && commission != null
      ? facPremium * (1 - commission / 100) - facPremium * deductionRate
      : facPremium;

  const riskEntries = useMemo(
    () => [
      ...placementDetailEntries(placement.businessDetails),
      ...placementDetailEntries(placement.offerDetails),
    ],
    [placement.businessDetails, placement.offerDetails],
  );

  const { statusText: premiumPaymentStatusText, latestPaymentDate } = usePremiumPaymentContext(
    placement.id,
  );

  // Same figure as the Claim Allocations table's "Total Allocated Claim" bar: the sum of
  // this claim's (non-void) reinsurer allocations, falling back to a participant-share
  // estimate before allocations have been generated.
  const { data: allocations = [] } = useClaimAllocations(placement.id, claim?.id ?? '');
  const allParticipants = useAllPlacementParticipants(placement.id, placement.participants ?? []);
  const claimAmount = claim ? parseFloat(claim.finalLossAmount ?? claim.estimatedLossAmount) : null;
  const claimShare = useMemo(() => {
    if (allocations.length > 0) {
      return allocations.reduce(
        (sum, allocation) =>
          sum +
          parseFloat(
            allocation.allocatedFinalLossAmount ?? allocation.allocatedEstimatedLossAmount,
          ),
        0,
      );
    }
    if (claimAmount == null) return null;
    return allParticipants
      .filter((p) => p.role !== 'BROKER' && (p.status === 'ACCEPTED' || p.status === 'CLOSED'))
      .reduce((sum, p) => {
        const share = p.sharePercent != null ? parseFloat(p.sharePercent) / 100 : 0;
        return sum + share * claimAmount;
      }, 0);
  }, [allocations, allParticipants, claimAmount]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Policy No." value={displayPolicyNumber(placement.policyNumber)} />
        <DetailField label="Reinsured" value={placement.cedant?.name ?? '—'} />
        <DetailField label="Insured" value={placement.title ?? '—'} />
        <DetailField label="Class of Risk" value={placement.classOfBusiness ?? '—'} />
        <DetailField
          label="Period of Insurance"
          value={`${fmtDate(placement.inceptionDate ?? '')} – ${fmtDate(placement.expiryDate ?? '')}`}
        />
        <DetailField
          label="Facultative Offer"
          value={facultativeOffer != null ? `${facultativeOffer}%` : '—'}
        />
        <DetailField label="Fac. Sum Insured" value={fmt(facSumInsured, currency)} />
        <DetailField label="Fac. Premium" value={fmt(netPremium, currency)} />
        <DetailField label="Claim entry Date" value={fmtDate(createdAt)} />
        <DetailField label="Premium Payment Status" value={premiumPaymentStatusText} />
        <DetailField
          label="Last Payment Date"
          value={latestPaymentDate ? fmtDate(latestPaymentDate) : '—'}
        />
        {riskEntries.map((entry) => (
          <DetailField key={entry.key} label={entry.label} value={fmtFieldValue(entry.value)} />
        ))}

        {claim && (
          <>
            <DetailField label="Claim Number" value={claim.claimNumber} />
            <DetailField label="Date of Loss" value={fmtDate(claim.occurrenceDate)} />
            <DetailField label="Reported Date" value={fmtDate(claim.reportedDate)} />
            <DetailField label="Claim Cause" value={claim.claimCause} />
            {claim.occurrenceDetails && (
              <DetailField label="Details" value={claim.occurrenceDetails} />
            )}
            <DetailField
              label="100% Estimated Claim"
              value={fmt(claim.estimatedLossAmount, claim.currency)}
            />
            {claim.finalLossAmount && (
              <DetailField
                label="100% Claim Amount"
                value={fmt(claim.finalLossAmount, claim.currency)}
              />
            )}
            {claim.finalLossAmount && (
              <DetailField label="iRisk Share" value={fmt(claimShare, claim.currency)} />
            )}
            {recoveredAt && <DetailField label="Recovered Date" value={fmtDate(recoveredAt)} />}
          </>
        )}
      </div>

      {/* {statusActions} */}
    </div>
  );
}
