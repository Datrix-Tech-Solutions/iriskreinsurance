'use client';

import { useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { TypeChip, TypeChipColor } from '@/components/atoms/TypeChip';
import { PaymentReceiptModal } from '@/components/organisms/reinsurance/documents/PaymentReceiptModal';
import { useClaimCedantSettlements, useClaimRecoveryPosition } from '@/hooks';
import { fmtDate, fmt } from '@/lib/reinsurance/claimFormat';
import {
  Facultative,
  PlacementClaim,
  PlacementClaimCedantSettlement,
  PlacementClaimRecoveryReceipt,
  PlacementPayment,
} from '@/types/reinsurance';

// The claim recovery receipt has no closing snapshot — carry over what it does
// have (amount, counterparty) and render it through the plain payment receipt.
function recoveryReceiptAsPayment(receipt: PlacementClaimRecoveryReceipt): PlacementPayment {
  return {
    ...receipt,
    type: 'CLAIM_SETTLEMENT',
    closing: null,
    endorsementClosing: null,
  } as unknown as PlacementPayment;
}

interface ClaimFinancialHistoryTableProps {
  placement: Facultative;
  claim: PlacementClaim;
}

type HistoryRowType = 'PAYABLE' | 'RECEIVABLE';

interface HistoryRow {
  id: string;
  type: HistoryRowType;
  date: string;
  counterpartyName: string;
  cashCallNumber: string | null;
  amount: string;
  currency: string;
  reference: string | null;
  settlement?: PlacementClaimCedantSettlement;
  receipt?: PlacementClaimRecoveryReceipt;
}

function modeOfPayment(row: HistoryRow): { label: string; color: TypeChipColor } | null {
  if (row.type === 'PAYABLE') {
    const method = row.settlement?.settlementMethod;
    return method ? { label: method.replaceAll('_', ' '), color: 'gray' } : null;
  }
  const method = row.receipt?.settlementMethod;
  if (method === 'INTERNAL_OFFSET') return { label: 'Offset Claim', color: 'purple' };
  if (method === 'OTHER') return { label: 'Direct to Cedant', color: 'teal' };
  return { label: 'Through Broker', color: 'blue' };
}

export function ClaimFinancialHistoryTable({ placement, claim }: ClaimFinancialHistoryTableProps) {
  const { data: settlements = [] } = useClaimCedantSettlements(placement.id, claim.id);
  const { data: position } = useClaimRecoveryPosition(placement.id, claim.id);
  const [receiptTarget, setReceiptTarget] = useState<PlacementClaimRecoveryReceipt | null>(null);

  const rows = useMemo<HistoryRow[]>(() => {
    const payableRows: HistoryRow[] = settlements.map((settlement) => ({
      id: `settlement-${settlement.id}`,
      type: 'PAYABLE',
      date: settlement.settlementDate,
      counterpartyName: placement.cedant.name,
      cashCallNumber: null,
      amount: settlement.amount,
      currency: settlement.currency,
      reference: settlement.reference,
      settlement,
    }));

    const receivableRows: HistoryRow[] = (position?.perCashCall ?? []).flatMap((cashCall) =>
      cashCall.receipts.map((receipt) => ({
        id: `receipt-${receipt.id}`,
        type: 'RECEIVABLE' as const,
        date: receipt.paymentDate,
        counterpartyName: cashCall.counterparty.name,
        cashCallNumber: cashCall.cashCallNumber,
        amount: receipt.amount,
        currency: receipt.currency,
        reference: receipt.reference,
        receipt,
      })),
    );

    return [...payableRows, ...receivableRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [settlements, position, placement.cedant.name]);

  const columns: Column<HistoryRow>[] = [
    {
      key: 'modeOfPayment',
      label: 'Mode of Payment',
      width: '150px',
      render: (row) => {
        const mode = modeOfPayment(row);
        return mode ? (
          <TypeChip label={mode.label} color={mode.color} />
        ) : (
          <span className="text-gray-400">—</span>
        );
      },
    },
    {
      key: 'date',
      label: 'Date',
      width: '90px',
      render: (row) => <span className="font-medium text-gray-600">{fmtDate(row.date)}</span>,
    },
    {
      key: 'participant',
      label: 'Participant',
      width: 'minmax(120px, 1fr)',
      render: (row) => <span className="font-bold text-gray-700">{row.counterpartyName}</span>,
    },
    {
      key: 'notes',
      label: 'Notes',
      width: 'minmax(140px, 1.5fr)',
      render: (row) => (
        <span className="font-semibold text-gray-600">
          {row.receipt?.notes ?? row.settlement?.notes ?? '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '150px',
      className: 'text-right pr-8',
      render: (row) => (
        <span className="block text-right font-bold text-gray-900">
          {fmt(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '110px',
      render: (row) =>
        row.receipt ? (
          <TableButton variant="blue" onClick={() => setReceiptTarget(row.receipt ?? null)}>
            Receipt
          </TableButton>
        ) : (
          <TableButton variant="blue" disabled tooltip="Printable receipt coming soon">
            Receipt
          </TableButton>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No settlements or recoveries recorded"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      {receiptTarget && (
        <PaymentReceiptModal
          isOpen
          placement={placement}
          payment={recoveryReceiptAsPayment(receiptTarget)}
          receiptNo={claim.claimNumber}
          onClose={() => setReceiptTarget(null)}
        />
      )}
    </div>
  );
}
