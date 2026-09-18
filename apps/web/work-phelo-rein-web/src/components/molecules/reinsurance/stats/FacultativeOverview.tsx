'use client';

import { useEffect, useMemo } from 'react';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { Icons } from '@/components/atoms/icons';
import { Facultative, FacultativeStatus } from '@/types/reinsurance';
import {
  confirmedNetPremiumFor,
  totalEffectivePremiumReceived,
  usePlacementClosings,
  usePlacementEndorsements,
  usePlacementEffectiveView,
  usePlacementPayments,
} from '@/hooks';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { facultativeStatusLabel } from '@/lib/reinsurance/placementStatus';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

export type PaymentStatus = 'Outstanding Payment' | 'Part Payment' | 'Paid';

// Overview badge intentionally shows every in-progress status as blue; only Closed differs.
const OVERVIEW_STATUS_VARIANT: Record<FacultativeStatus, 'info' | 'success'> = {
  DRAFT: 'info',
  MARKETING: 'info',
  PARTIALLY_PLACED: 'info',
  PLACED: 'info',
  CLOSING: 'info',
  CLOSED: 'success',
  DECLINED: 'info',
  CANCELLED: 'info',
};

const STATUS_PING_COLOR: Record<'info' | 'success', { ping: string; dot: string }> = {
  info: { ping: 'bg-blue-400', dot: 'bg-blue-500' },
  success: { ping: 'bg-green-400', dot: 'bg-green-500' },
};

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  'Outstanding Payment': 'text-xs text-gray-400',
  'Part Payment': 'text-xs text-yellow-600 font-medium',
  Paid: 'text-xs text-green-600 font-medium',
};

function fmtFieldValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null, currency: string | null) {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

interface FacultativeOverviewProps {
  placement: Facultative;
  onPaymentStatusChange?: (status: PaymentStatus) => void;
}

export function FacultativeOverview({
  placement,
  onPaymentStatusChange,
}: FacultativeOverviewProps) {
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const { data: closings = [] } = usePlacementClosings(placement.id);
  const { data: endorsements = [] } = usePlacementEndorsements(placement.id);
  const endorsementCount = endorsements.filter((e) => e.status !== 'VOID').length;
  const { data: effectiveView, isError: effectiveViewError } = usePlacementEffectiveView(
    placement.id,
  );
  const effectiveTerms = effectiveView?.effectiveTerms;
  const effectiveTotals = effectiveView?.effectiveTotals;

  const paymentStatus = useMemo<PaymentStatus>(() => {
    const netPremium = confirmedNetPremiumFor(closings);
    const paid = totalEffectivePremiumReceived(payments);
    if (netPremium > 0 && paid >= netPremium) return 'Paid';
    if (paid > 0) return 'Part Payment';
    return 'Outstanding Payment';
  }, [payments, closings]);

  useEffect(() => {
    onPaymentStatusChange?.(paymentStatus);
  }, [paymentStatus, onPaymentStatusChange]);

  const currentCurrency =
    effectiveTerms?.currency ?? effectiveTotals?.currency ?? placement.currency;
  const facOffer =
    effectiveTotals?.facultativeOfferPercent ??
    effectiveTerms?.facultativeOfferPercent ??
    placement.facultativeOffer ??
    0;
  const premiumValue = effectiveTerms?.premium ?? effectiveTotals?.premium ?? placement.premium;
  const sumInsuredValue =
    effectiveTerms?.sumInsured ?? effectiveTotals?.sumInsured ?? placement.sumInsured;
  const commissionValue =
    effectiveTerms?.commissionPercent ?? effectiveTotals?.commissionPercent ?? placement.commission;
  const rateValue = effectiveTerms?.rate ?? effectiveTotals?.rate ?? placement.rate;
  const titleValue = effectiveTerms?.title ?? placement.title;
  const inceptionDate = effectiveTerms?.inceptionDate ?? placement.inceptionDate;
  const expiryDate = effectiveTerms?.expiryDate ?? placement.expiryDate;
  const facSumInsured = sumInsuredValue != null ? sumInsuredValue * (facOffer / 100) : null;
  const snapshotGrossPremium =
    effectiveView && effectiveView.effectiveParticipants.length > 0
      ? effectiveTotals?.grossPremium
      : null;
  const facPremium =
    snapshotGrossPremium ?? (premiumValue != null ? premiumValue * (facOffer / 100) : null);
  const appliedEndorsementCount = effectiveView?.appliedEndorsements.length ?? 0;
  const scheduledEndorsementCount = effectiveView?.scheduledEndorsements.length ?? 0;
  const pendingEndorsementCount = effectiveView?.pendingEndorsements.length ?? 0;

  const riskEntries = [
    ...placementDetailEntries(effectiveTerms?.businessDetails ?? placement.businessDetails),
    ...placementDetailEntries(effectiveTerms?.offerDetails ?? placement.offerDetails),
  ];

  const statusLabel = facultativeStatusLabel(placement.status);
  const statusVariant = OVERVIEW_STATUS_VARIANT[placement.status];

  return (
    <CollapsibleOverview
      headerExtra={
        <>
          <span className="flex items-center gap-1.5">
            <Badge label={statusLabel} variant={statusVariant} />
            {placement.status === 'CLOSED' ? (
              <Icons.CircleCheckBig className="w-3.5 h-3.5 text-green-500 mail-pending-bounce" />
            ) : (
              <span className="relative flex w-2 h-2">
                <span
                  className={`absolute inline-flex w-full h-full rounded-full opacity-105 animate-ping ${STATUS_PING_COLOR[statusVariant].ping}`}
                />
                <span
                  className={`relative inline-flex w-2 h-2 rounded-full ${STATUS_PING_COLOR[statusVariant].dot}`}
                />
              </span>
            )}
          </span>
          <span className="text-sm text-gray-500">|</span>
          <span className={PAYMENT_STATUS_CLASS[paymentStatus]}>{paymentStatus}</span>
          {endorsementCount > 0 && (
            <>
              <span className="text-sm text-gray-500">|</span>
              <span className="text-xs text-gray-600 font-medium">
                {endorsementCount} endorsement{endorsementCount > 1 ? 's' : ''}
              </span>
            </>
          )}
          {appliedEndorsementCount > 0 && (
            <>
              <span className="text-sm text-gray-500">|</span>
              <span className="text-xs text-green-600 font-medium">
                {appliedEndorsementCount} active endorsement
                {appliedEndorsementCount > 1 ? 's' : ''} as of{' '}
                {fmtDate(effectiveView?.viewAsOf ?? '')}
              </span>
            </>
          )}
          {scheduledEndorsementCount > 0 && (
            <>
              <span className="text-sm text-gray-500">|</span>
              <span className="text-xs text-gray-600 font-medium">
                {scheduledEndorsementCount} upcoming endorsement
                {scheduledEndorsementCount > 1 ? 's' : ''}
              </span>
            </>
          )}
          {pendingEndorsementCount > 0 && (
            <>
              <span className="text-sm text-gray-500">|</span>
              <span className="text-xs text-amber-700 font-medium">
                {pendingEndorsementCount} pending endorsement
                {pendingEndorsementCount > 1 ? 's' : ''}
              </span>
            </>
          )}
        </>
      }
    >
      {effectiveViewError && (
        <div className="mb-4 text-xs text-amber-700">
          Current offer terms could not be loaded; showing original offer term.
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Class of Risk" value={placement.classOfBusiness ?? '—'} />
        <DetailField label="Policy No." value={displayPolicyNumber(placement.policyNumber)} />
        <DetailField label="Reinsured" value={placement.cedant.name} />
        <DetailField label="Insured" value={titleValue} />
        <DetailField
          label="Period of Insurance"
          value={`${fmtDate(inceptionDate ?? '')} – ${fmtDate(expiryDate ?? '')}`}
        />
        {riskEntries.map((entry) => (
          <DetailField key={entry.key} label={entry.label} value={fmtFieldValue(entry.value)} />
        ))}
        {rateValue != null && <DetailField label="Rate (%)" value={`${rateValue}%`} />}
        <DetailField
          label="Cedant Commission (%)"
          value={commissionValue != null ? `${commissionValue}%` : '—'}
        />
        <DetailField label="Fac. Offer (%)" value={`${facOffer}%`} />
        <DetailField label="Premium" value={fmtAmount(premiumValue, currentCurrency)} />
        <DetailField label="Sum Insured" value={fmtAmount(sumInsuredValue, currentCurrency)} />
        <DetailField label="Fac. Sum Insured" value={fmtAmount(facSumInsured, currentCurrency)} />
        <DetailField label="Fac. Premium" value={fmtAmount(facPremium, currentCurrency)} />
      </div>
    </CollapsibleOverview>
  );
}
