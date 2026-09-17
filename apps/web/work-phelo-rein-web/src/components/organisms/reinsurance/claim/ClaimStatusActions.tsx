'use client';

import { Button } from '@/components/atoms/Button';
import { useClaimFinancialCloseReadiness, useUpdateClaimStatus } from '@/hooks';
import { extractError } from '@/lib/extractError';
import {
  CLAIM_STATUS_LABEL,
  CLAIM_STATUS_TRANSITIONS,
  FINANCIAL_CLOSE_BLOCKER_LABEL,
} from '@/lib/reinsurance/claimStatus';
import { useToastStore } from '@/store/toast.store';
import { PlacementClaim, PlacementClaimStatus } from '@/types/reinsurance';

interface ClaimStatusActionsProps {
  placementId: string;
  claim: PlacementClaim;
}

/** "Mark …" buttons that advance a claim through its status state machine, with `SETTLED`/
 * `CLOSED` gated live against backend financial-close readiness. */
export function ClaimStatusActions({ placementId, claim }: ClaimStatusActionsProps) {
  const addToast = useToastStore((s) => s.addToast);
  const updateStatus = useUpdateClaimStatus(placementId, claim.id);
  const nextStatuses = CLAIM_STATUS_TRANSITIONS[claim.status];
  const needsReadiness = nextStatuses.some((s) => s === 'SETTLED' || s === 'CLOSED');
  const { data: readiness } = useClaimFinancialCloseReadiness(placementId, claim.id);

  if (nextStatuses.length === 0) return null;

  const isBlocked = (status: PlacementClaimStatus) => {
    if (!readiness) return false;
    if (status === 'SETTLED') return !readiness.isFinanciallyReadyToSettle;
    if (status === 'CLOSED') return !readiness.isFinanciallyReadyToClose;
    return false;
  };

  const handleTransition = async (status: PlacementClaimStatus) => {
    if (isBlocked(status)) return;
    try {
      await updateStatus.mutateAsync(status);
      addToast({ message: `Claim moved to ${CLAIM_STATUS_LABEL[status]}`, type: 'success' });
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-500">Advance Status:</span>
        {nextStatuses.map((status) => {
          const blocked = isBlocked(status);
          return (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={status === 'DECLINED' || status === 'VOID' ? 'outline' : 'secondary'}
              disabled={blocked || updateStatus.isPending}
              isLoading={updateStatus.isPending && updateStatus.variables === status}
              title={blocked ? 'Blocked by financial close readiness — see below' : undefined}
              onClick={() => handleTransition(status)}
            >
              Mark {CLAIM_STATUS_LABEL[status]}
            </Button>
          );
        })}
      </div>

      {needsReadiness && !!readiness?.blockers.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Financial close blockers:</span>{' '}
          {readiness.blockers.map((b) => FINANCIAL_CLOSE_BLOCKER_LABEL[b] ?? b).join(' · ')}
        </div>
      )}
    </div>
  );
}
