'use client';

import { Facultative, PlacementEndorsement } from '@/types/reinsurance';
import { useReinsurers } from '@/hooks';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  DocumentAmountTable,
  DocumentContentFrame,
  DocumentSignature,
} from '@/components/molecules/documents/DocumentContentFrame';

/** Normalized shape both an original placement closing and an endorsement closing
 *  map to, so either renders through this same letter document. */
export interface ClosingLetterData {
  id: string;
  closingNumber: string;
  status: string;
  currency: string | null;
  signedLinePercent: string | number | null;
  sumInsuredSnapshot: string | number | null;
  premiumSnapshot: string | number | null;
  commissionPercent: string | number | null;
  commissionAmount: string | number | null;
  brokeragePercent: string | number | null;
  brokerageAmount: string | number | null;
  netPremium: string | number | null;
  reinsurer: { id: string; name: string };
}

interface Row {
  label: string;
  pct?: string;
  value?: string;
  bold?: boolean;
}

function fmtFieldValue(val: unknown): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

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

function toNum(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return Number.isNaN(n) ? null : n;
}

function getSnapshotPlacement(snapshot: Record<string, unknown>): Record<string, unknown> {
  if (snapshot.placement && typeof snapshot.placement === 'object') {
    return snapshot.placement as Record<string, unknown>;
  }
  return snapshot;
}

function longToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export interface ClosingLetterContentProps {
  placement: Facultative;
  endorsement?: PlacementEndorsement;
  closing: ClosingLetterData;
}

/** The reinsurer-facing "Closings" letter, populated from a closing snapshot —
 *  content only, rendered with the shared document type system. */
export function ClosingLetterContent({
  placement,
  endorsement,
  closing,
}: ClosingLetterContentProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const reinsurer = closing.reinsurer;
  const fullReinsurer = reinsurers.find((r) => r.id === reinsurer.id);
  const addr = fullReinsurer?.addresses?.find((a) => a.isPrimary) ?? fullReinsurer?.addresses?.[0];
  const reinsurerCity = addr?.city ?? null;
  const reinsurerRegionCountry = [addr?.state, addr?.country].filter(Boolean).join(' - ') || null;

  // Prefer the endorsement's proposed terms when this closing came from an endorsement.
  const proposed = endorsement?.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;
  const originalPlacement = endorsement ? getSnapshotPlacement(endorsement.originalSnapshot) : null;
  const pick = <T,>(key: string, fallback: T): T => {
    const source = proposed ?? originalPlacement;
    if (!source) return fallback;
    return source[key] !== undefined && source[key] !== null ? (source[key] as T) : fallback;
  };

  const title = pick<string>('title', placement.title);
  const classOfBusiness = pick<string | null>('classOfBusiness', placement.classOfBusiness);
  const inceptionDate = pick<string | null>('inceptionDate', placement.inceptionDate);
  const expiryDate = pick<string | null>('expiryDate', placement.expiryDate);

  const currency = closing.currency ?? placement.currency;
  const signedLinePercent = toNum(closing.signedLinePercent);
  const sumInsuredSnapshot = toNum(closing.sumInsuredSnapshot);
  const premiumSnapshot = toNum(closing.premiumSnapshot);
  const commissionPercent = toNum(closing.commissionPercent) ?? 0;
  const commissionAmount = toNum(closing.commissionAmount) ?? 0;
  const brokeragePercent = toNum(closing.brokeragePercent) ?? 0;
  const brokerageAmount = toNum(closing.brokerageAmount) ?? 0;
  const totalCommissionPct = commissionPercent + brokeragePercent;
  const totalCommissionAmt = commissionAmount + brokerageAmount;
  const netPremium = toNum(closing.netPremium);

  const riskDetailRows: Row[] = [
    ...placementDetailEntries(
      pick<Record<string, unknown> | null>('businessDetails', placement.businessDetails),
    ),
    ...placementDetailEntries(
      pick<Record<string, unknown> | null>('offerDetails', placement.offerDetails),
    ),
  ].map((entry) => ({ label: entry.label, value: fmtFieldValue(entry.value) }));

  const descriptionRows: Row[] = [
    { label: 'Reinsured', value: placement.cedant.name },
    { label: 'Insured', value: title },
    { label: 'Policy Number', value: displayPolicyNumber(placement.policyNumber) },
    { label: 'Class of Insurance', value: classOfBusiness ?? '—' },
    ...riskDetailRows,
    { label: 'Period of Insurance', value: `${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}` },
    { label: 'Currency', value: currency ?? '—' },
  ];

  const financialRows: Row[] = [
    { label: 'Your Share', pct: signedLinePercent != null ? `${signedLinePercent}%` : '—' },
    { label: 'Your Sum Insured', value: fmtAmount(sumInsuredSnapshot, currency) },
    { label: 'Your Premium', value: fmtAmount(premiumSnapshot, currency) },
    {
      label: 'Less Commission',
      pct: `${totalCommissionPct}%`,
      value: fmtAmount(totalCommissionAmt, currency),
    },
    { label: 'Net Premium', value: fmtAmount(netPremium, currency), bold: true },
  ];

  return (
    <DocumentContentFrame title="Closings" showTitle={false}>
      <div
        className="flex flex-col gap-[0.3em]"
        style={{ fontFamily: 'var(--doc-font-content)', marginBottom: 'var(--doc-space-section)' }}
      >
        <p className="text-gray-500">{longToday()}</p>
        <p className="mt-[1em] text-gray-900">The Managing Director</p>
        <p className="text-gray-800">{reinsurer.name}</p>
        {reinsurerCity && <p className="text-gray-600">{reinsurerCity}</p>}
        {reinsurerRegionCountry && <p className="text-gray-600">{reinsurerRegionCountry}</p>}
        <p className="mt-[1em] text-gray-900">Dear Sir/Madam</p>
        <p className="mt-[0.75em] font-semibold text-gray-900">
          Facultative Reinsurance Application
        </p>
        <p className="mt-[0.5em] leading-relaxed text-gray-700">
          We refer to the risk below and your subsequent acceptance of a share of the same risk.
        </p>
        <p className="leading-relaxed text-gray-700">
          Kindly issue your guarantee in accordance with the information below.
        </p>
      </div>

      <DocumentAmountTable rows={[...descriptionRows, ...financialRows]} />

      <div
        className="flex flex-col gap-[0.2em] text-gray-700"
        style={{ fontFamily: 'var(--doc-font-content)', marginTop: 'var(--doc-space-section)' }}
      >
        <p>Thank You.</p>
        <p>Yours faithfully,</p>
        <DocumentSignature />
      </div>
    </DocumentContentFrame>
  );
}
