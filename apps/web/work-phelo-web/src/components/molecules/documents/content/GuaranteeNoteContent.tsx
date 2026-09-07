'use client';

import { Facultative } from '@/types/reinsurance';
import { useCedants } from '@/hooks';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  DocumentContentFrame,
  DocumentField,
  DocumentSectionHeader,
} from '@/components/molecules/documents/DocumentContentFrame';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function longToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null | undefined, currency: string | null): string {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

export interface GuaranteeNoteContentProps {
  placement: Facultative;
  /** Post-endorsement totals, when this placement has an endorsement in market. */
  facultativeOfferOverride?: number;
  sumInsuredOverride?: number | null;
  premiumOverride?: number | null;
  commissionOverride?: number | null;
  currencyOverride?: string | null;
  titleOverride?: string | null;
  policyNumberOverride?: string | null;
  inceptionDateOverride?: string | null;
  expiryDateOverride?: string | null;
  /** Post-endorsement share per reinsurer, keyed by counterpartyId. */
  participantShareOverrides?: Record<string, number>;
  effectiveParticipantOverrides?: Array<{
    id: string;
    counterpartyName: string;
    displaySharePercent: number;
  }>;
}

/** The guarantee note — content only, rendered with the shared document type system. */
export function GuaranteeNoteContent({
  placement,
  facultativeOfferOverride,
  sumInsuredOverride,
  premiumOverride,
  commissionOverride,
  currencyOverride,
  titleOverride,
  policyNumberOverride,
  inceptionDateOverride,
  expiryDateOverride,
  participantShareOverrides,
  effectiveParticipantOverrides,
}: GuaranteeNoteContentProps) {
  const { data: cedants = [] } = useCedants();

  const {
    currency,
    facultativeOffer,
    sumInsured,
    premium,
    commission,
    classOfBusiness,
    title,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
    participants,
  } = placement;

  const fullCedant = cedants.find((c) => c.id === cedant.id);
  const cedantAddr = fullCedant?.addresses?.find((a) => a.isPrimary) ?? fullCedant?.addresses?.[0];
  const displayName = cedant.name;
  const displayCity = cedantAddr?.city ?? null;
  const displayRegionCountry =
    [cedantAddr?.state, cedantAddr?.country].filter(Boolean).join(' - ') || null;

  const facOffer = facultativeOfferOverride ?? facultativeOffer ?? 0;
  const effectiveSumInsured = sumInsuredOverride ?? sumInsured;
  const effectivePremium = premiumOverride ?? premium;
  const effectiveCommission = commissionOverride ?? commission;
  const effectiveCurrency = currencyOverride ?? currency;
  const effectiveTitle = titleOverride ?? title;
  const effectivePolicyNumber = policyNumberOverride ?? policyNumber;
  const effectiveInceptionDate = inceptionDateOverride ?? inceptionDate;
  const effectiveExpiryDate = expiryDateOverride ?? expiryDate;

  const facSumInsured = effectiveSumInsured != null ? (facOffer / 100) * effectiveSumInsured : null;
  const facPremium = effectivePremium != null ? (facOffer / 100) * effectivePremium : null;
  const commissionAmount =
    facPremium != null ? ((effectiveCommission ?? 0) / 100) * facPremium : null;
  const netPremium =
    facPremium != null && commissionAmount != null ? facPremium - commissionAmount : null;

  const participantRows =
    effectiveParticipantOverrides ??
    participants
      .filter(
        (p) =>
          (p.role === 'REINSURER' || p.role === 'LEAD_REINSURER' || p.role === 'CO_REINSURER') &&
          p.status === 'CLOSED' &&
          parseFloat(p.sharePercent ?? '0') > 0,
      )
      .map((p) => ({
        id: p.id,
        counterpartyName: p.counterparty.name,
        displaySharePercent:
          participantShareOverrides?.[p.counterpartyId] ?? parseFloat(p.sharePercent ?? '0'),
      }));

  return (
    <DocumentContentFrame title="Guarantee Note" showTitle={false}>
      <div
        className="flex flex-col gap-[0.3em]"
        style={{ fontFamily: 'var(--doc-font-content)', marginBottom: 'var(--doc-space-section)' }}
      >
        <p className="text-gray-500">{longToday()}</p>
        <p className="mt-[1em] text-gray-900">The Managing Director</p>
        <p className="text-gray-800">{displayName}</p>
        {displayCity && <p className="text-gray-600">{displayCity}</p>}
        {displayRegionCountry && <p className="text-gray-600">{displayRegionCountry}</p>}
        <p className="mt-[1em] text-center font-semibold text-gray-900 underline">GUARANTEE NOTE</p>
      </div>

      <DocumentSectionHeader>Policy Details and Risk Description</DocumentSectionHeader>
      <DocumentField label="Cover Type" value={classOfBusiness} />
      <DocumentField label="Reinsured" value={cedant.name} />
      <DocumentField label="Policy Number" value={displayPolicyNumber(effectivePolicyNumber)} />
      <DocumentField label="Original Insured" value={effectiveTitle} />
      <DocumentField label="Currency" value={effectiveCurrency} />
      <DocumentField
        label="Insurance Period"
        value={`${fmtDate(effectiveInceptionDate)} – ${fmtDate(effectiveExpiryDate)}`}
      />
      <DocumentField
        label="Sum Insured"
        value={fmtAmount(effectiveSumInsured, effectiveCurrency)}
      />
      <DocumentField label="Premium" value={fmtAmount(effectivePremium, effectiveCurrency)} />
      <DocumentField
        label="Facultative (Offer)"
        value={
          facSumInsured != null
            ? `${fmtAmount(facSumInsured, effectiveCurrency)} (${facOffer}% of 100%)`
            : null
        }
      />
      <DocumentField label="Facultative Premium" value={fmtAmount(facPremium, effectiveCurrency)} />
      <DocumentField
        label={`Commission (${effectiveCommission ?? 0}%)`}
        value={fmtAmount(commissionAmount, effectiveCurrency)}
      />
      <DocumentField label="Net Premium" value={fmtAmount(netPremium, effectiveCurrency)} strong />

      <p
        className="text-gray-400"
        style={{ fontFamily: 'var(--doc-font-content)', marginTop: 'var(--doc-space-section)' }}
      >
        Reinsurance Participant(s):
      </p>
      {participantRows.length === 0 ? (
        <p className="text-gray-400" style={{ fontFamily: 'var(--doc-font-content)' }}>
          No participants assigned.
        </p>
      ) : (
        participantRows.map((p) => (
          <DocumentField
            key={p.id}
            label={p.counterpartyName}
            value={`${p.displaySharePercent}% of 100%`}
          />
        ))
      )}
    </DocumentContentFrame>
  );
}
