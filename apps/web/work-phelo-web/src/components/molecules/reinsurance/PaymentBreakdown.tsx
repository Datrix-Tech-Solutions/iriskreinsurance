'use client';

import {
  EffectivePlacementView,
  Facultative,
  PlacementFinancialPosition,
  PlacementPayment,
} from '@/types/reinsurance';
import { DetailField } from '@/components/atoms/DetailField';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { fmtDate } from '@/lib/reinsurance/claimFormat';
import { premiumForeignSettlement } from '@/lib/reinsurance/premiumSettlement';

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRate(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

interface PaymentBreakdownProps {
  placement?: Facultative | null;
  financialPosition?: PlacementFinancialPosition | null;
  effectiveView?: EffectivePlacementView | null;
  /** Placement payments — used to express "Received" in the currency the cedant actually
   * settled in when every confirmed premium receipt shared one foreign currency and rate. */
  payments?: PlacementPayment[];
}

/** Placement facts + premium position figures, in the same `DetailField` tile grid format as
 * `FacultativeOverview`/`ClaimDetailsPanel`. Rendered inside `PaymentOverview`'s
 * `CollapsibleOverview` card, so it stays unboxed here rather than wrapping itself in another
 * card. */
export function PaymentBreakdown({
  placement,
  financialPosition,
  effectiveView,
  payments,
}: PaymentBreakdownProps) {
  const { policyNumber, title, cedant, classOfBusiness, inceptionDate, expiryDate, currency } =
    placement ?? {
      policyNumber: null,
      title: null,
      cedant: null,
      classOfBusiness: null,
      inceptionDate: null,
      expiryDate: null,
      currency: null,
    };

  const position = financialPosition?.cedant;
  const positionCurrency = financialPosition?.currency ?? currency;
  const outstanding = position?.outstanding ?? 0;
  const isCredit = position?.position === 'CREDIT_BALANCE' || outstanding < 0;

  const netSettled = position?.netSettled ?? 0;
  const fxSettlement = premiumForeignSettlement(payments, positionCurrency);
  // obligation = settlement × rate, so settlement = obligation ÷ rate.
  const receivedValue = fxSettlement
    ? `${fmt(netSettled / fxSettlement.rate, fxSettlement.currency)} (${fmt(netSettled, positionCurrency)})`
    : fmt(netSettled, positionCurrency);

  // Brokerage isn't a single rate set on the offer — it's the sum of each participating
  // reinsurer's brokerage cut, aggregated server-side from confirmed closings.
  const brokerageAmount = effectiveView?.effectiveTotals.brokerageAmount ?? null;
  const grossPremium = effectiveView?.effectiveTotals.grossPremium ?? null;
  const brokeragePercent =
    brokerageAmount != null && grossPremium ? (brokerageAmount / grossPremium) * 100 : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
      <DetailField label="Policy No." value={displayPolicyNumber(policyNumber)} />
      <DetailField label="Reinsured" value={cedant?.name ?? '—'} />
      <DetailField label="Insured" value={title ?? '—'} />
      <DetailField label="Class of Risk" value={classOfBusiness ?? '—'} />
      <DetailField
        label="Period of Insurance"
        value={`${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}`}
      />
      <DetailField
        label="Original Premium"
        value={fmt(position?.originalObligation ?? 0, positionCurrency)}
      />
      <DetailField
        label="Endorsement Premium"
        value={fmt(position?.endorsementAdjustments ?? 0, positionCurrency)}
      />
      <DetailField
        label="Current Premium"
        value={fmt(position?.currentObligation ?? 0, positionCurrency)}
      />
      <DetailField
        label="Brokerage"
        value={
          brokerageAmount != null
            ? `${fmt(brokerageAmount, positionCurrency)}${brokeragePercent != null ? ` (${brokeragePercent.toFixed(2)}%)` : ''}`
            : '—'
        }
      />
      <DetailField label="Received" value={receivedValue} />
      {fxSettlement && (
        <DetailField
          label="Rate Used"
          value={`1 ${fxSettlement.currency} = ${fmtRate(fxSettlement.rate)} ${positionCurrency ?? ''}`.trim()}
        />
      )}
      <DetailField
        label={isCredit ? 'Credit / Refund Position' : 'Outstanding'}
        value={fmt(Math.abs(outstanding), positionCurrency)}
      />
      <DetailField
        label="Gross Recorded"
        value={fmt(position?.grossRecorded ?? 0, positionCurrency)}
      />
      <DetailField label="Reversed" value={fmt(position?.reversed ?? 0, positionCurrency)} />
    </div>
  );
}
