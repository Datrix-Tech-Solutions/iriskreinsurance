'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { RecordRecoveryReceiptModal } from '@/components/organisms/reinsurance/RecordRecoveryReceiptModal';
import { useClaimCashCalls, useClaimRecoveryPosition, RecoveryRow } from '@/hooks';
import { fmt } from '@/lib/reinsurance/claimFormat';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { Facultative, PlacementClaim, PlacementClaimCashCall } from '@/types/reinsurance';

interface ClaimCashCallsTableProps {
  placement: Facultative;
  claim: PlacementClaim;
}

const MS_PER_HOUR = 1000 * 60 * 60;

function formatAging(ms: number): string {
  const totalHours = Math.floor(ms / MS_PER_HOUR);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days}d ${hours}hr` : `${hours}hr`;
}

export function ClaimCashCallsTable({ placement, claim }: ClaimCashCallsTableProps) {
  const { data: cashCalls = [] } = useClaimCashCalls(placement.id, claim.id);
  const { data: position } = useClaimRecoveryPosition(placement.id, claim.id);
  const [recoveryRow, setRecoveryRow] = useState<RecoveryRow | null>(null);

  const perCashCallFor = (cashCall: PlacementClaimCashCall) =>
    position?.perCashCall.find((p) => p.cashCallId === cashCall.id);

  const buildRecoveryRow = (cashCall: PlacementClaimCashCall): RecoveryRow | null => {
    const perCashCall = perCashCallFor(cashCall);
    if (!perCashCall) return null;
    return {
      id: `${claim.id}-${cashCall.id}`,
      placementId: placement.id,
      claimId: claim.id,
      cashCallId: cashCall.id,
      allocationId: perCashCall.allocationId,
      policyNumber: displayPolicyNumber(placement.policyNumber),
      insuredTitle: placement.title,
      riskType: placement.classOfBusiness,
      reinsurerId: cashCall.counterpartyId,
      reinsurerName: cashCall.counterparty.name,
      claimNumber: claim.claimNumber,
      cashCallNumber: cashCall.cashCallNumber,
      cashCallStatus: cashCall.status,
      currency: cashCall.currency,
      calledAmount: parseFloat(perCashCall.calledAmount),
      recoveredAmount: parseFloat(perCashCall.recoveredAmount),
      recordedAmount: parseFloat(perCashCall.recordedAmount),
      confirmedAmount: parseFloat(perCashCall.confirmedAmount),
      reversedAmount: parseFloat(perCashCall.reversedAmount),
      outstandingAmount: parseFloat(perCashCall.outstandingAmount),
      recoveryStatus: perCashCall.recoveryStatus,
      receipts: perCashCall.receipts,
      occurrenceDate: claim.occurrenceDate,
    };
  };

  const columns: Column<PlacementClaimCashCall>[] = useMemo(
    () => [
      {
        key: 'counterparty',
        label: 'Reinsurer',
        width: 'minmax(120px, 1fr)',
        render: (row) => <span className="text-gray-700">{row.counterparty.name}</span>,
      },
      {
        key: 'amount',
        label: 'Amount',
        width: '150px',
        className: 'text-right pr-8',
        render: (row) => (
          <span className="text-gray-900 block text-right">{fmt(row.amount, row.currency)}</span>
        ),
      },
      {
        key: 'recovered',
        label: 'Recovered',
        width: '150px',
        className: 'text-right pr-8',
        render: (row) => {
          const perCashCall = perCashCallFor(row);
          const confirmed = parseFloat(perCashCall?.confirmedAmount ?? '0');
          const recorded = parseFloat(perCashCall?.recordedAmount ?? '0');
          if (confirmed > 0.0001) {
            return (
              <span className="block text-right font-bold text-green-600">
                {fmt(confirmed, row.currency)}
              </span>
            );
          }
          if (recorded > 0.0001) {
            return (
              <span className="block text-right font-medium text-amber-600">
                {fmt(recorded, row.currency)}
              </span>
            );
          }
          return <span className="text-gray-700 block text-right">{fmt(0, row.currency)}</span>;
        },
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        width: '150px',
        className: 'text-right pr-8',
        render: (row) => {
          const recovery = buildRecoveryRow(row);
          const outstanding = recovery?.outstandingAmount ?? 0;
          return (
            <span
              className={`block text-right font-medium ${
                outstanding > 0 ? 'text-orange-600' : 'text-gray-900'
              }`}
            >
              {fmt(outstanding, row.currency)}
            </span>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        width: '120px',
        render: (row) => {
          if (row.status === 'VOID') return <Badge label="Void" variant="danger" />;
          if (row.status === 'DRAFT') return <Badge label="Draft" variant="neutral" />;

          const perCashCall = perCashCallFor(row);

          const recoveryStatus = perCashCall?.recoveryStatus;
          const statusBadge =
            recoveryStatus === 'FULLY_RECOVERED' ? (
              <Badge label="Paid" variant="success" />
            ) : recoveryStatus === 'PARTIALLY_RECOVERED' ? (
              <Badge label="Part Payment" variant="warning" />
            ) : (
              <Badge label="Outstanding" variant="neutral" />
            );

          return <div className="flex flex-col items-start gap-1">{statusBadge}</div>;
        },
      },
      {
        key: 'aging',
        label: 'Aging',
        width: '100px',
        render: (row) => {
          if (!row.issuedAt) return <span className="text-xs text-gray-400">—</span>;
          if (row.status === 'DRAFT' || row.status === 'VOID') {
            return <span className="text-xs text-gray-400">—</span>;
          }

          const perCashCall = perCashCallFor(row);
          const issuedAtMs = new Date(row.issuedAt).getTime();

          if (perCashCall?.recoveryStatus === 'FULLY_RECOVERED') {
            const confirmedTimes = (perCashCall.receipts ?? [])
              .filter(
                (receipt) =>
                  receipt.status === 'BANK_CONFIRMED' &&
                  !receipt.reversalOfReceiptId &&
                  receipt.bankConfirmedAt,
              )
              .map((receipt) => new Date(receipt.bankConfirmedAt as string).getTime());
            const completedAtMs =
              confirmedTimes.length > 0 ? Math.max(...confirmedTimes) : Date.now();
            return (
              <span className="text-gray-600">
                {formatAging(Math.max(0, completedAtMs - issuedAtMs))}
              </span>
            );
          }

          return <span className="text-gray-600">{formatAging(Date.now() - issuedAtMs)}</span>;
        },
      },
      {
        key: 'actions',
        label: 'Actions',
        width: '150px',
        className: 'pr-6',
        render: (row) => {
          const recovery = buildRecoveryRow(row);
          const outstanding = recovery?.outstandingAmount ?? 0;
          const perCashCall = perCashCallFor(row);
          const recorded = parseFloat(perCashCall?.recordedAmount ?? '0');

          const fullyPending = outstanding > 0.0001 && recorded >= outstanding - 0.0001;
          const canRecord =
            row.status === 'ISSUED' && !!recovery && outstanding > 0.0001 && !fullyPending;
          return (
            <TableButton
              variant={canRecord ? 'blue' : 'gray'}
              disabled={!canRecord}
              tooltip={
                row.status !== 'ISSUED'
                  ? 'Only issued cash calls can receive recovery receipts.'
                  : outstanding <= 0.0001
                    ? 'Fully recovered — see the History tab for receipts.'
                    : fullyPending
                      ? 'Already fully recorded — awaiting bank confirmation.'
                      : undefined
              }
              onClick={() => recovery && setRecoveryRow(recovery)}
            >
              Record Recovery
            </TableButton>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [position],
  );

  return (
    <div className="flex flex-col gap-2">
      <DataTable
        columns={columns}
        data={cashCalls}
        extraFilters={
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900">Claim Recoveries</span>
          </div>
        }
        emptyMessage="No recoveries for this claim"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      <RecordRecoveryReceiptModal row={recoveryRow} onClose={() => setRecoveryRow(null)} />
    </div>
  );
}
