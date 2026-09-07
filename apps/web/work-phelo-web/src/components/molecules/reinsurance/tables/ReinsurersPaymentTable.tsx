'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Facultative,
  PlacementFinancialPosition,
  PlacementReinsurerFinancialPosition,
} from '@/types/reinsurance';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { RecordDisbursementPanel } from '@/components/organisms/reinsurance/panels/RecordDisbursementPanel';
import { usePlacementPayments } from '@/hooks';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { premiumForeignSettlement } from '@/lib/reinsurance/premiumSettlement';

interface ReinsurersPaymentTableProps {
  placement: Facultative;
  financialPosition?: PlacementFinancialPosition | null;
  paidAmount?: number;
  onTotalChange?: (total: number) => void;
}

type ReinsurerPositionRow = PlacementReinsurerFinancialPosition & {
  id: string;
};

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRate(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function positionBadge(position: PlacementReinsurerFinancialPosition['position']) {
  if (position === 'SETTLED') return <Badge label="Settled" variant="success" />;
  if (position === 'CREDIT_BALANCE') return <Badge label="Credit" variant="warning" />;
  return <Badge label="Payable" variant="warning" />;
}

export function ReinsurersPaymentTable({
  placement,
  financialPosition,
  onTotalChange,
}: ReinsurersPaymentTableProps) {
  const [paymentTarget, setPaymentTarget] = useState<PlacementReinsurerFinancialPosition | null>(
    null,
  );

  const { data: payments = [] } = usePlacementPayments(placement.id);
  const canDisburse = useAnyPermissionRules(RiPerm.addPayment);

  const obligationCurrency = financialPosition?.currency ?? placement.currency ?? null;
  // When the cedant premium came in as a single foreign currency, show every figure here in
  // that currency at that rate: obligation = display × rate.
  const fx = useMemo(
    () => premiumForeignSettlement(payments, obligationCurrency),
    [payments, obligationCurrency],
  );
  const displayCurrency = fx ? fx.currency : obligationCurrency;
  const conv = (obligationValue: number) => (fx ? obligationValue / fx.rate : obligationValue);

  const pendingByCounterparty = useMemo(() => {
    const map = new Map<string, number>();
    for (const payment of payments) {
      if (payment.type !== 'REINSURER_DISBURSEMENT') continue;
      if (payment.status !== 'RECORDED') continue;
      if (payment.reversalOfPaymentId) continue;
      const amount = parseFloat(payment.amount) || 0;
      map.set(payment.counterpartyId, (map.get(payment.counterpartyId) ?? 0) + amount);
    }
    return map;
  }, [payments]);

  const rows = useMemo<ReinsurerPositionRow[]>(
    () =>
      financialPosition?.reinsurers.map((row) => ({
        ...row,
        id: row.counterpartyId,
      })) ?? [],
    [financialPosition?.reinsurers],
  );

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.currentEffectivePayable, 0),
    [rows],
  );
  const displayTotal = fx ? total / fx.rate : total;

  useEffect(() => {
    onTotalChange?.(displayTotal);
  }, [displayTotal, onTotalChange]);

  const columns: Column<ReinsurerPositionRow>[] = useMemo(
    () => [
      {
        key: 'counterpartyName',
        label: 'Reinsurer',
        width: 'minmax(150px, 1fr)',
        render: (row) => <span className="font-medium text-gray-900">{row.counterpartyName}</span>,
      },
      {
        key: 'currentEffectivePayable',
        label: 'Current Payable',
        width: '130px',
        className: 'text-right',
        render: (row) => (
          <span className="text-gray-900 block text-right">
            {fmt(conv(row.currentEffectivePayable), displayCurrency)}
          </span>
        ),
      },
      {
        key: 'paid',
        label: 'Paid',
        width: '130px',
        className: 'text-right',
        render: (row) => {
          if (row.netSettled > 0.0001) {
            return (
              <span className="block text-right font-bold text-green-600">
                {fmt(conv(row.netSettled), displayCurrency)}
              </span>
            );
          }
          const pending = pendingByCounterparty.get(row.counterpartyId) ?? 0;
          if (pending > 0.0001) {
            return (
              <span className="block text-right font-medium text-amber-600">
                {fmt(conv(pending), displayCurrency)}
                {/* <span className="block text-xs font-normal text-amber-500">Pending approval</span> */}
              </span>
            );
          }
          return <span className="block text-right text-gray-700">{fmt(0, displayCurrency)}</span>;
        },
      },
      {
        key: 'outstanding',
        label: 'Outstanding',
        width: '140px',
        className: 'text-right',
        render: (row) => (
          <span
            className={`block text-right font-medium ${
              row.outstanding > 0 ? 'text-orange-600' : 'text-gray-900'
            }`}
          >
            {fmt(conv(Math.abs(row.outstanding)), displayCurrency)}
          </span>
        ),
      },
      {
        key: 'position',
        label: 'Status',
        width: '100px',
        render: (row) => positionBadge(row.position),
      },
      ...(canDisburse
        ? [
            {
              key: 'counterpartyId',
              label: 'Actions',
              width: '150px',
              className: 'pr-6',
              render: (row: ReinsurerPositionRow) => {
                const pending = pendingByCounterparty.get(row.counterpartyId) ?? 0;
                const fullyPending = pending >= row.outstanding - 0.0001;
                return (
                  <TableButton
                    disabled={row.outstanding <= 0.0001 || fullyPending}
                    onClick={() => setPaymentTarget(row)}
                  >
                    Disburse Payment
                  </TableButton>
                );
              },
            } as Column<ReinsurerPositionRow>,
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayCurrency, fx?.rate, pendingByCounterparty, canDisburse],
  );

  return (
    <div className="flex flex-col gap-0">
      {fx && (
        <p className="mb-1 text-xs text-gray-500">
          Amounts in {fx.currency} · 1 {fx.currency} = {fmtRate(fx.rate)} {obligationCurrency ?? ''}
        </p>
      )}
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No current reinsurer obligations"
        currentPage={1}
        totalPages={0}
        onPageChange={() => {}}
        noInternalScroll
      />

      <RecordDisbursementPanel
        placement={placement}
        financialPosition={financialPosition}
        target={paymentTarget}
        onClose={() => setPaymentTarget(null)}
      />
    </div>
  );
}
