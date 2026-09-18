'use client';

import { useCallback, useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { NumberField } from '@/components/atoms/NumberField';
import { TableButton } from '@/components/atoms/TableButton';
import { MailPreviewModal } from '@/components/organisms/reinsurance/MailPreviewModal';
import { ClaimDebitNoteModal } from '@/components/organisms/reinsurance/documents/ClaimDebitNoteModal';
import {
  useAllPlacementParticipants,
  useApproveClaimRecovery,
  useClaimCashCalls,
  useClaimRecoveryApprovals,
  useReinsurers,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { cardClass } from '@/lib/utils';
import { fmt } from '@/lib/reinsurance/claimFormat';
import { useToastStore } from '@/store/toast.store';
import { Facultative, PlacementClaim, PlacementClaimAllocation } from '@/types/reinsurance';

interface ClaimRecoveryApprovalsPanelProps {
  placement: Facultative;
  claim: PlacementClaim;
  allocations: PlacementClaimAllocation[];
}

export function ClaimRecoveryApprovalsPanel({
  placement,
  claim,
  allocations,
}: ClaimRecoveryApprovalsPanelProps) {
  const addToast = useToastStore((s) => s.addToast);
  const { data: approvals = [] } = useClaimRecoveryApprovals(placement.id, claim.id);
  const { data: cashCalls = [] } = useClaimCashCalls(placement.id, claim.id);
  const { data: reinsurers = [] } = useReinsurers();
  const approveRecovery = useApproveClaimRecovery(placement.id, claim.id);
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const [approvingAllocationId, setApprovingAllocationId] = useState<string | null>(null);
  const [mailTarget, setMailTarget] = useState<PlacementClaimAllocation | null>(null);
  const [debitNoteTarget, setDebitNoteTarget] = useState<PlacementClaimAllocation | null>(null);

  const claimAmount = parseFloat(claim.finalLossAmount ?? claim.estimatedLossAmount);

  const allParticipants = useAllPlacementParticipants(placement.id, placement.participants ?? []);

  const resolveParticipant = useCallback(
    (allocation: PlacementClaimAllocation) =>
      allParticipants.find((p) => p.counterpartyId === allocation.counterpartyId),
    [allParticipants],
  );

  const reinsurerEmails = useMemo<Record<string, string[]>>(
    () =>
      Object.fromEntries(
        reinsurers.map((r) => {
          const emails: string[] = [];
          if (r.email) emails.push(r.email);
          r.contacts.forEach((c) => {
            if (c.email) emails.push(c.email);
          });
          return [r.id, emails];
        }),
      ),
    [reinsurers],
  );

  const mailParticipant = mailTarget ? resolveParticipant(mailTarget) : undefined;
  const mailRecipients = mailParticipant
    ? (reinsurerEmails[mailParticipant.counterpartyId] ?? [])
    : [];
  const debitNoteParticipant = debitNoteTarget ? resolveParticipant(debitNoteTarget) : undefined;

  // A cash call(for recoveries) only ever gets created via "Send Mail" below, so its existence for an
  const cashCallByAllocation = useMemo(() => {
    const map = new Map<string, string>();
    cashCalls.forEach((cashCall) => map.set(cashCall.allocationId, cashCall.id));
    return map;
  }, [cashCalls]);

  const approvedByAllocation = useMemo(() => {
    const totals = new Map<string, number>();
    approvals.forEach((approval) => {
      totals.set(
        approval.allocationId,
        (totals.get(approval.allocationId) ?? 0) + parseFloat(approval.approvedAmount),
      );
    });
    return totals;
  }, [approvals]);

  const handleApprove = useCallback(
    async (allocation: PlacementClaimAllocation) => {
      const amount = Math.round((parseFloat(draftAmounts[allocation.id] ?? '') || 0) * 100) / 100;
      if (amount <= 0) return;
      setApprovingAllocationId(allocation.id);
      try {
        await approveRecovery.mutateAsync({
          allocationId: allocation.id,
          approvedAmount: amount,
          // Traces this approval back to the specific demand it's answering.
          cashCallId: cashCallByAllocation.get(allocation.id),
        });
        setDraftAmounts((current) => ({ ...current, [allocation.id]: '' }));
        addToast({ message: 'Reinsurer recovery recorded', type: 'success' });
      } catch (error) {
        addToast({ message: extractError(error), type: 'error' });
      } finally {
        setApprovingAllocationId(null);
      }
    },
    [addToast, approveRecovery, cashCallByAllocation, draftAmounts],
  );

  const allocationColumns: Column<PlacementClaimAllocation>[] = useMemo(
    () => [
      {
        key: 'reinsurer',
        label: 'Reinsurer',
        width: 'minmax(140px, 1fr)',
        render: (row) => <span className="font-medium text-gray-900">{row.counterparty.name}</span>,
      },
      {
        key: 'allocatedAmount',
        label: 'Allocated Claim',
        width: '150px',
        className: 'text-right pr-8',
        render: (row) => (
          <span className="block text-right text-gray-700">
            {fmt(
              parseFloat(row.allocatedFinalLossAmount ?? row.allocatedEstimatedLossAmount),
              claim.currency,
            )}
          </span>
        ),
      },
      {
        key: 'approvedAmount',
        label: 'Recovered',
        width: '150px',
        className: 'text-right pr-8',
        render: (row) => (
          <span className="block text-right text-gray-700">
            {fmt(approvedByAllocation.get(row.id) ?? 0, claim.currency)}
          </span>
        ),
      },
      {
        key: 'remaining',
        label: 'Remaining',
        width: '150px',
        className: 'text-right pr-8',
        render: (row) => {
          const allocatedAmount = parseFloat(
            row.allocatedFinalLossAmount ?? row.allocatedEstimatedLossAmount,
          );
          const remaining = Math.max(allocatedAmount - (approvedByAllocation.get(row.id) ?? 0), 0);
          return (
            <span className="block text-right font-medium text-gray-900">
              {fmt(remaining, claim.currency)}
            </span>
          );
        },
      },
      {
        key: 'actions',
        label: 'Action',
        width: '220px',
        className: 'pr-6 text-right',
        render: (row) => {
          const allocatedAmount = parseFloat(
            row.allocatedFinalLossAmount ?? row.allocatedEstimatedLossAmount,
          );
          const remaining = Math.max(allocatedAmount - (approvedByAllocation.get(row.id) ?? 0), 0);
          const isVoid = row.status === 'VOID';
          const isSent = cashCallByAllocation.has(row.id);

          if (isVoid) {
            return <span className="block text-xs text-gray-400">Void</span>;
          }

          // Nothing to record yet — they haven't been told their share, so there's nothing
          // for them to have responded to.
          if (!isSent) {
            return (
              <div className="flex items-center justify-end gap-2">
                <TableButton variant="blue" onClick={() => setDebitNoteTarget(row)}>
                  Preview
                </TableButton>
                <TableButton variant="green" onClick={() => setMailTarget(row)}>
                  Send Mail
                </TableButton>
              </div>
            );
          }

          if (remaining <= 0) {
            return <span className="block text-xs text-gray-400">Approved</span>;
          }

          // Sent — record what they came back with. Can be less than (or, if they push back,
          // different from) what was demanded.
          return (
            <div className="flex items-center justify-end gap-2">
              <NumberField
                value={draftAmounts[row.id] ? Number(draftAmounts[row.id]) : 0}
                onChange={(n) =>
                  setDraftAmounts((current) => ({
                    ...current,
                    [row.id]: n ? String(n) : '',
                  }))
                }
                placeholder={String(remaining)}
              />
              <TableButton
                variant="green"
                disabled={!draftAmounts[row.id]}
                isLoading={approveRecovery.isPending && approvingAllocationId === row.id}
                onClick={() => handleApprove(row)}
              >
                Approve
              </TableButton>
            </div>
          );
        },
      },
    ],
    [
      approvedByAllocation,
      approveRecovery.isPending,
      approvingAllocationId,
      cashCallByAllocation,
      claim.currency,
      draftAmounts,
      handleApprove,
    ],
  );

  if (allocations.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className={cardClass('p-6 w-full')}>
        <span className="text-sm font-bold text-gray-900">Reinsurer Recovery Approvals</span>
        <p className="text-xs text-gray-500">
          Formal per-reinsurer agreement that recognizes the recovery receivable, ahead of any cash
          movement. Once sent, use Approve to record what they responded with.
        </p>
      </div>

      <DataTable
        columns={allocationColumns}
        data={allocations}
        emptyMessage="No allocations for this claim"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      {mailTarget && mailParticipant && (
        <MailPreviewModal
          isOpen
          placement={placement}
          brokerageFee={parseFloat(mailParticipant.brokerageFee ?? '0')}
          recipients={mailRecipients}
          claim={claim}
          allocation={mailTarget}
          onSend={() => setMailTarget(null)}
          onClose={() => setMailTarget(null)}
        />
      )}

      {debitNoteTarget && debitNoteParticipant && (
        <ClaimDebitNoteModal
          isOpen
          placement={placement}
          participant={debitNoteParticipant}
          claimAmount={claimAmount}
          onClose={() => setDebitNoteTarget(null)}
        />
      )}
    </div>
  );
}
