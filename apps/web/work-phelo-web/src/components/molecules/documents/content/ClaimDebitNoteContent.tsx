'use client';

import {
  Facultative,
  PlacementClaim,
  PlacementClaimAllocation,
  PlacementParticipant,
} from '@/types/reinsurance';
import { useReinsurers } from '@/hooks';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  DocumentContentFrame,
  DocumentField,
} from '@/components/molecules/documents/DocumentContentFrame';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null | undefined, currency: string | null | undefined): string {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

function fmtNum(val: number): string {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function longToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const groupLabelStyle = {
  fontFamily: 'var(--doc-font-content)',
  marginTop: 'var(--doc-space-section)',
} as const;

const proseBlockStyle = {
  fontFamily: 'var(--doc-font-content)',
  marginBottom: 'var(--doc-space-section)',
} as const;

const closingBlockStyle = {
  fontFamily: 'var(--doc-font-content)',
  marginTop: 'var(--doc-space-section)',
} as const;

export interface ClaimDebitNoteContentProps {
  placement: Facultative;
  participant: PlacementParticipant;
  claim?: PlacementClaim;
  claimAmount?: number | null;
  /** Confirmed-closing-snapshot allocation for this reinsurer, when one exists. */
  allocation?: PlacementClaimAllocation;
  /** 'claim' (default) — the invoice-style Claim Debit Note. 'notification' — the
   *  Notification stage's advice letter. Same data, different document. */
  mode?: 'claim' | 'notification';
}

/** The claim debit note / claim notification — content only, rendered with the
 *  shared document type system. The signatory block comes from the page template. */
export function ClaimDebitNoteContent({
  placement,
  participant,
  claim,
  claimAmount,
  allocation,
  mode = 'claim',
}: ClaimDebitNoteContentProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const reinsurer = reinsurers.find((r) => r.id === participant.counterpartyId);
  const addr = reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];
  const reinsurerCity = addr?.city ?? null;
  const reinsurerRegionCountry = [addr?.state, addr?.country].filter(Boolean).join(' - ') || null;

  const { currency, classOfBusiness, title, policyNumber, inceptionDate, expiryDate, cedant } =
    placement;

  const sharePercent = allocation
    ? parseFloat(allocation.signedLinePercent)
    : parseFloat(participant.sharePercent ?? '0');
  const amountDue = allocation
    ? parseFloat(allocation.allocatedFinalLossAmount ?? allocation.allocatedEstimatedLossAmount)
    : claimAmount != null
      ? (sharePercent / 100) * claimAmount
      : null;

  const isNotification = mode === 'notification';

  if (isNotification) {
    return (
      <DocumentContentFrame title="Claim Notification">
        <div className="flex flex-col gap-[0.3em]" style={proseBlockStyle}>
          <p className="text-gray-900">{participant.counterparty.name}</p>
          {addr?.line1 && <p className="text-gray-700">{addr.line1}</p>}
          {addr?.line2 && <p className="text-gray-700">{addr.line2}</p>}
          {(addr?.city || addr?.country) && (
            <p className="text-gray-700">
              {[addr?.city, addr?.country].filter(Boolean).join(', ')}
            </p>
          )}
          <p className="mt-[1em] text-gray-500">Date: {longToday()}</p>
          <p className="mt-[1em] font-semibold text-gray-900">
            RE: CLAIM NOTIFICATION – {title ?? '—'} – {cedant.name} – {classOfBusiness ?? '—'}
          </p>
          <p className="mt-[1em] text-gray-900">Dear Sir/Madam,</p>
          <p className="mt-[0.75em] leading-relaxed text-gray-700">
            We hereby notify you of a claim under the above risk, which may give rise to a recovery
            under the applicable reinsurance arrangement.
          </p>
        </div>

        <DocumentField label="Name of Insured" value={title ?? '—'} />
        <DocumentField label="Cedant" value={cedant.name} />
        <DocumentField label="Risk Class" value={classOfBusiness ?? '—'} />
        <DocumentField label="Policy No." value={displayPolicyNumber(policyNumber)} />
        <DocumentField label="Claim No." value={claim?.claimNumber ?? '—'} />
        <DocumentField label="Date of Loss" value={fmtDate(claim?.occurrenceDate)} />
        <DocumentField label="Nature of Loss" value={claim?.claimCause ?? '—'} />
        <DocumentField label="Estimated Gross Loss" value={fmtAmount(claimAmount, currency)} />
        <DocumentField
          label="Estimated Reinsurance Exposure"
          value={fmtAmount(amountDue, currency)}
        />

        <div className="flex flex-col gap-2 text-gray-700" style={closingBlockStyle}>
          <p className="leading-relaxed">
            Kindly acknowledge receipt of this notification. Further information will be provided as
            it becomes available.
          </p>
          <p className="leading-relaxed">
            This notification is made without prejudice and subject to the terms and conditions of
            the applicable reinsurance contract.
          </p>
          <p>Yours faithfully,</p>
          <p className="italic">
            This notification does not constitute an admission of liability or confirmation of
            coverage.
          </p>
        </div>
      </DocumentContentFrame>
    );
  }

  return (
    <DocumentContentFrame title="Claim Debit Note">
      <div className="flex flex-col gap-[0.3em]" style={proseBlockStyle}>
        <p className="text-gray-500">{longToday()}</p>
        <p className="mt-[1em] text-gray-900">The Managing Director</p>
        <p className="text-gray-800">{participant.counterparty.name}</p>
        {reinsurerCity && <p className="text-gray-600">{reinsurerCity}</p>}
        {reinsurerRegionCountry && <p className="text-gray-600">{reinsurerRegionCountry}</p>}
        <p className="mt-[1em] text-gray-900">Dear Sir/Madam</p>
        <p className="mt-[0.75em] leading-relaxed text-gray-700">
          We refer to the risk below and wish to advise you of a claim under the above policy.
          Kindly remit the amount due in accordance with the information below.
        </p>
      </div>

      <p className="font-semibold text-gray-500" style={groupLabelStyle}>
        Description
      </p>
      <DocumentField label="Reinsured" value={cedant.name} />
      <DocumentField label="Policy Type" value={classOfBusiness ?? '—'} />
      <DocumentField label="Insured" value={title ?? '—'} />
      <DocumentField label="Policy Number" value={displayPolicyNumber(policyNumber)} />
      <DocumentField
        label="Policy Period"
        value={`${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}`}
      />
      <DocumentField label="Currency" value={currency ?? '—'} />

      <DocumentField label="Claim amount" value={fmtAmount(claimAmount, currency)} />
      <DocumentField label="Your reinsurance participation" value={`${sharePercent}% of 100%`} />
      <DocumentField
        label="Amount Due from you"
        value={amountDue != null ? fmtNum(amountDue) : null}
        strong
      />

      <div className="flex flex-col gap-2 text-gray-700" style={closingBlockStyle}>
        <p>Thank You.</p>
        <p>Yours faithfully,</p>
      </div>
    </DocumentContentFrame>
  );
}
