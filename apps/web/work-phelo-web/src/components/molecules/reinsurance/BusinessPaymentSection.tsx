'use client';

import { useState } from 'react';
import { Facultative } from '@/types/reinsurance';
import { PaymentBreakdown } from '@/components/molecules/reinsurance/PaymentBreakdown';
import { ReinsurersPaymentTable } from '@/components/molecules/reinsurance/tables/ReinsurersPaymentTable';
import {
  usePlacementFinancialPosition,
  usePlacementPayments,
} from '@/hooks/reinsurance/usePayments';
import { premiumForeignSettlement } from '@/lib/reinsurance/premiumSettlement';
import { cardClass } from '@/lib/utils';

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface BusinessPaymentSectionProps {
  placement: Facultative;
  paidAmount?: number;
  /** Set false when the caller already shows `PaymentOverview` (which itself wraps
   * `PaymentBreakdown`) above this section — e.g. the payment detail page's Overview tab —
   * so the fact panel isn't rendered twice. Defaults true for the flat "new payment" flow,
   * which has no persistent overview above it. */
  showBreakdown?: boolean;
}

export function BusinessPaymentSection({
  placement,
  paidAmount,
  showBreakdown = true,
}: BusinessPaymentSectionProps) {
  const [total, setTotal] = useState(0);
  const { data: financialPosition } = usePlacementFinancialPosition(placement.id);
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const obligationCurrency = financialPosition?.currency ?? placement.currency;
  // `ReinsurersPaymentTable` reports its total already converted into the premium's foreign
  // settlement currency when one applies, so label the Total with that same currency.
  const fx = premiumForeignSettlement(payments, obligationCurrency);
  const currency = fx ? fx.currency : obligationCurrency;

  return (
    <div className={cardClass('flex flex-col gap-4 p-4')}>
      <div className="flex flex-col md:flex-row gap-4 items-start">
        {showBreakdown && (
          <div className={cardClass('w-full md:flex-1 min-w-0 p-5')}>
            <PaymentBreakdown placement={placement} financialPosition={financialPosition} />
          </div>
        )}
        <div className="w-full md:flex-2 min-w-0">
          <ReinsurersPaymentTable
            placement={placement}
            financialPosition={financialPosition}
            paidAmount={paidAmount}
            onTotalChange={setTotal}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
        <span className="font-semibold text-gray-900">Total</span>
        <span className="font-semibold text-gray-900">{fmt(total, currency)}</span>
      </div>
    </div>
  );
}
