'use client';

import { useMemo, useState } from 'react';
import { Facultative, PlacementClaim, PlacementParticipant } from '@/types/reinsurance';
import { ClaimDebitNoteModal } from '@/components/organisms/reinsurance/documents/ClaimDebitNoteModal';
import { ClaimCedantSettlementPanel } from '@/components/organisms/reinsurance/claim/ClaimCedantSettlementPanel';
import { ClaimReinsurersTable } from '@/components/molecules/reinsurance/claim/ClaimReinsurersTable';
import {
  useAllPlacementParticipants,
  useClaimAllocations,
  useClaimCashCalls,
  useUpdateClaimStatus,
  useCreateClaimCashCall,
  useUpdateClaimCashCallStatus,
  useApproveClaimRecovery,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { cardClass } from '@/lib/utils';
import { fmt } from '@/lib/reinsurance/claimFormat';

interface ClaimOverviewTabProps {
  placement: Facultative;
  claim?: PlacementClaim;
}

export function ClaimOverviewTab({ placement, claim }: ClaimOverviewTabProps) {
  const { data: allocations = [] } = useClaimAllocations(placement.id, claim?.id ?? '');
  const { data: cashCalls = [] } = useClaimCashCalls(placement.id, claim?.id ?? '');
  const [debitNoteTarget, setDebitNoteTarget] = useState<PlacementParticipant | null>(null);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const updateClaimStatus = useUpdateClaimStatus(placement.id, claim?.id ?? '');
  const createCashCall = useCreateClaimCashCall(placement.id, claim?.id ?? '');
  const updateCashCallStatus = useUpdateClaimCashCallStatus(placement.id, claim?.id ?? '');
  const approveRecovery = useApproveClaimRecovery(placement.id, claim?.id ?? '');
  const addToast = useToastStore((s) => s.addToast);

  // Includes reinsurers added via an endorsement — placement.participants alone only reflects
  // the original placement closing, so it silently misses those.
  const allParticipants = useAllPlacementParticipants(placement.id, placement.participants ?? []);

  const claimAmount = claim ? parseFloat(claim.finalLossAmount ?? claim.estimatedLossAmount) : null;
  const isActualAmount = !!claim?.finalLossAmount;

  // A PENDING claim has no generated allocations: show the allocations table read-only
  // (no Preview / Send Mail column) and hide the cedant settlement list entirely.
  const isPending = claim?.claimState === 'PENDING';

  // A cash call only ever gets created via "Send Mail" below, so its existence for an
  // allocation means their share has already been sent to them.
  const sentAllocationIds = useMemo(
    () => new Set(cashCalls.map((cashCall) => cashCall.allocationId)),
    [cashCalls],
  );

  const debitNoteAllocation = debitNoteTarget
    ? allocations.find((a) => a.counterpartyId === debitNoteTarget.counterpartyId)
    : undefined;

  // Skips the mail compose/preview modal entirely — the "Send Mail" button fires the same
  // notify → issue cash call → approve recovery chain the modal used to run on Send, matching
  // the one-click flow the distribution list uses for its mail action.
  const handleSendMail = async (participant: PlacementParticipant) => {
    if (!claim) return;
    // Match by counterpartyId, not participantId — allocations sourced from an endorsement
    // closing carry endorsementParticipantId instead, so participantId alone would miss those.
    const allocation = allocations.find((a) => a.counterpartyId === participant.counterpartyId);
    const key = allocation?.id ?? participant.id;
    if (sendingIds.has(key)) return;

    setSendingIds((prev) => new Set(prev).add(key));
    try {
      await updateClaimStatus.mutateAsync('NOTIFIED');
      if (allocation) {
        const cashCall = await createCashCall.mutateAsync(allocation.id);
        await updateCashCallStatus.mutateAsync({ cashCallId: cashCall.id, status: 'ISSUED' });
        // Recognizes the receivable for the full demanded amount at send time, so a recovery
        // approval always exists once a cash call is issued — recording a receipt against it
        // later (Cash Calls tab) no longer needs a separate approval step of its own.
        await approveRecovery.mutateAsync({
          allocationId: allocation.id,
          approvedAmount: parseFloat(cashCall.amount),
          cashCallId: cashCall.id,
        });
      }
      addToast({
        message: `Cash call sent to ${participant.counterparty.name}.`,
        type: 'success',
      });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const totalActualClaim = useMemo(() => {
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
    return (placement.participants ?? [])
      .filter((p) => p.role !== 'BROKER' && (p.status === 'ACCEPTED' || p.status === 'CLOSED'))
      .reduce((sum, p) => {
        const share = p.sharePercent != null ? parseFloat(p.sharePercent) / 100 : 0;
        return sum + share * claimAmount;
      }, 0);
  }, [allocations, placement.participants, claimAmount]);

  return (
    <div className={cardClass('flex flex-col gap-4 p-4')}>
      <ClaimReinsurersTable
        participants={allParticipants}
        allocations={allocations}
        claimAmount={claimAmount}
        isActualAmount={isActualAmount}
        currency={claim?.currency ?? placement.currency}
        sentAllocationIds={sentAllocationIds}
        busyIds={sendingIds}
        showActions={!isPending}
        onMail={handleSendMail}
        onPreview={setDebitNoteTarget}
      />

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
        <span className="font-semibold text-gray-900">
          {allocations.length > 0 ? 'Total Allocated Claim' : 'Total Claim Estimate'}
        </span>
        <span className="font-semibold text-gray-900">
          {fmt(totalActualClaim, claim?.currency ?? placement.currency)}
        </span>
      </div>

      {claim && !isPending && (
        <ClaimCedantSettlementPanel placementId={placement.id} claim={claim} />
      )}

      {debitNoteTarget && (
        <ClaimDebitNoteModal
          isOpen
          placement={placement}
          participant={debitNoteTarget}
          claim={claim}
          claimAmount={claimAmount}
          allocation={debitNoteAllocation}
          mode={isActualAmount ? 'claim' : 'notification'}
          onClose={() => setDebitNoteTarget(null)}
        />
      )}
    </div>
  );
}
