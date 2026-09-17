'use client';

import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { Badge } from '@/components/atoms/Badge';
import { PaymentBreakdown } from '@/components/molecules/reinsurance/PaymentBreakdown';
import { Facultative } from '@/types/reinsurance';
import {
  usePlacementEffectiveView,
  usePlacementFinancialPosition,
  usePlacementPayments,
} from '@/hooks';
import {
  CedantPaymentStatus,
  cedantPaymentStatusFromPosition,
  pendingPremiumReceived,
} from '@/lib/reinsurance/placementStatus';

const PAYMENT_STATUS_VARIANT: Record<CedantPaymentStatus, 'neutral' | 'warning' | 'success'> = {
  Outstanding: 'neutral',
  Pending: 'warning',
  'Part Payment': 'warning',
  Paid: 'success',
};

interface PaymentOverviewProps {
  placement: Facultative;
}

/** Persistent, collapsible payment fact summary shown above the payment detail tabs — mirrors
 * `FacultativeOverview`/`ClaimOverview`. Wraps `PaymentBreakdown` (policy terms + the premium
 * position figures) so it stays visible across tabs instead of living inside the Overview tab. */
export function PaymentOverview({ placement }: PaymentOverviewProps) {
  const { data: financialPosition } = usePlacementFinancialPosition(placement.id);
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const { data: effectiveView } = usePlacementEffectiveView(placement.id);

  const due = financialPosition?.cedant.currentObligation ?? 0;
  const paid = financialPosition?.cedant.netSettled ?? 0;
  const outstanding = financialPosition?.cedant.outstanding ?? 0;
  const pending = pendingPremiumReceived(payments);
  const paymentStatus = cedantPaymentStatusFromPosition(due, paid, outstanding, pending);

  return (
    <CollapsibleOverview
      headerExtra={
        <>
          <span className="text-sm text-gray-500">|</span>
          <Badge label={paymentStatus} variant={PAYMENT_STATUS_VARIANT[paymentStatus]} />
        </>
      }
    >
      <PaymentBreakdown
        placement={placement}
        financialPosition={financialPosition}
        effectiveView={effectiveView}
        payments={payments}
      />
    </CollapsibleOverview>
  );
}
