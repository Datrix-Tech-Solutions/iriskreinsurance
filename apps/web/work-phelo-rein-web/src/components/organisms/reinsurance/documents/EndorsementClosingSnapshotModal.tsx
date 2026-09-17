'use client';

import Image from 'next/image';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import {
  EndorsementParticipantClosing,
  Facultative,
  PlacementEndorsement,
} from '@/types/reinsurance';
import { useReinsurers, useRiskTypes } from '@/hooks';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

interface EndorsementClosingSnapshotModalProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement: PlacementEndorsement;
  closing: EndorsementParticipantClosing | null;
  onClose: () => void;
}

interface ClosingRow {
  label: string;
  pct?: string;
  value?: string;
  bold?: boolean;
  divider?: boolean;
}

function fmtFieldValue(val: unknown): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null | undefined, currency: string | null | undefined) {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function getSnapshotPlacement(snapshot: Record<string, unknown>): Record<string, unknown> {
  if (snapshot.placement && typeof snapshot.placement === 'object') {
    return snapshot.placement as Record<string, unknown>;
  }
  return snapshot;
}

function toNum(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(n) ? null : n;
}

/**
 * Reinsurer-facing "Closings" document for a confirmed endorsement closing — same letter +
 * description/financial table layout as the placement-side "Closings" document
 * (NoteDocumentModal's credit-note content), just populated with this closing's confirmed,
 * post-endorsement figures instead of a persisted note.
 */
export function EndorsementClosingSnapshotModal({
  isOpen,
  placement,
  endorsement,
  closing,
  onClose,
}: EndorsementClosingSnapshotModalProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const { data: riskTypes = [] } = useRiskTypes();

  if (!closing) return null;

  const reinsurer = closing.endorsementParticipant.counterparty;
  const fullReinsurer = reinsurers.find((r) => r.id === reinsurer.id);
  const addr = fullReinsurer?.addresses?.find((a) => a.isPrimary) ?? fullReinsurer?.addresses?.[0];
  const reinsurerCity = addr?.city ?? null;
  const reinsurerRegionCountry = [addr?.state, addr?.country].filter(Boolean).join(' - ') || null;
  const riskTypeName = riskTypes.find((rt) => rt.id === placement.riskTypeId)?.name ?? null;

  // Prefer the endorsement's current (proposed) terms — these tables show the risk as it
  // stands after this endorsement, not the terms at original placement.
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;
  const originalPlacement = getSnapshotPlacement(endorsement.originalSnapshot);
  const pick = <T,>(key: string, fallback: T): T => {
    const source = proposed ?? originalPlacement;
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

  const riskDetailRows: ClosingRow[] = [
    ...placementDetailEntries(
      pick<Record<string, unknown> | null>('businessDetails', placement.businessDetails),
    ),
    ...placementDetailEntries(
      pick<Record<string, unknown> | null>('offerDetails', placement.offerDetails),
    ),
  ].map((entry) => ({ label: entry.label, value: fmtFieldValue(entry.value) }));

  const descriptionRows: ClosingRow[] = [
    { label: 'Reinsured', value: placement.cedant.name },
    { label: 'Insured', value: title },
    { label: 'Policy Number', value: displayPolicyNumber(placement.policyNumber) },
    { label: 'Class of Insurance', value: classOfBusiness ?? '—' },
    ...riskDetailRows,
    { label: 'Period of Insurance', value: `${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}` },
    { label: 'Currency', value: currency ?? '—' },
  ];

  const financialRows: ClosingRow[] = [
    { label: 'Your Share', pct: signedLinePercent != null ? `${signedLinePercent}%` : '—' },
    { label: 'Your Sum Insured', value: fmtAmount(sumInsuredSnapshot, currency) },
    { label: 'Your Premium', value: fmtAmount(premiumSnapshot, currency) },
    {
      label: 'Less Commission',
      pct: `${totalCommissionPct}%`,
      value: fmtAmount(totalCommissionAmt, currency),
    },
    { label: '', divider: true },
    { label: 'Net Premium', value: fmtAmount(netPremium, currency), bold: true },
  ];

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Closings — ${displayPolicyNumber(placement.policyNumber)}`}
      documentTitle="Closings"
      fileName={buildDocumentFileName(
        'Closings',
        displayPolicyNumber(placement.policyNumber),
        riskTypeName,
        title,
        reinsurer.name ? `to ${reinsurer.name}` : null,
      )}
      qrValue={`${closing.closingNumber}:${closing.id}:${closing.status}`}
      onPrint={() => {}}
      onClose={onClose}
    >
      <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide pt-1 pb-2 text-center">
        Endorsement Closing Statement
      </p>

      {/* Address block */}
      <div className="flex flex-col gap-0.5 text-base mb-4">
        <p className="text-gray-500">
          {new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
        <p className="font-medium text-gray-900 mt-2">The Managing Director</p>
        <p className="text-gray-800">{reinsurer.name}</p>
        {reinsurerCity && <p className="text-gray-600">{reinsurerCity}</p>}
        {reinsurerRegionCountry && <p className="text-gray-600">{reinsurerRegionCountry}</p>}
        <p className="font-medium text-gray-900 mt-2">Dear Sir/Madam</p>
        <p className="text-gray-700 mt-3 leading-relaxed">
          We refer to the risk below and your confirmed participation following this endorsement.
          Kindly find the confirmed closing particulars below.
        </p>
      </div>

      <table className="w-full text-base border-collapse">
        <tbody>
          {descriptionRows.map((row, i) => (
            <tr key={i}>
              <td className="py-2 pr-4 text-gray-500 w-1/2">{row.label}</td>
              <td className="py-2 px-4 text-center text-gray-600 w-1/6 whitespace-nowrap">
                {row.pct ?? ''}
              </td>
              <td className="py-2 pl-4 text-right w-1/3 wrap-break-word text-gray-800">
                {row.value ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full text-base border-collapse">
        <tbody>
          {financialRows.map((row, i) =>
            row.divider ? (
              <tr key={i}>
                <td colSpan={3} className="py-1">
                  <hr className="border-gray-100" />
                </td>
              </tr>
            ) : (
              <tr key={i}>
                <td
                  className={`py-2 pr-4 text-gray-500 w-1/2 ${row.bold ? 'font-semibold text-gray-900' : ''}`}
                >
                  {row.label}
                </td>
                <td className="py-2 px-4 text-center text-gray-600 w-1/6 whitespace-nowrap">
                  {row.pct ?? ''}
                </td>
                <td
                  className={`py-2 pl-4 text-right w-1/3 wrap-break-word ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-800'}`}
                >
                  {row.value ?? ''}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <div className="mt-4 flex flex-col gap-2 text-base text-gray-700">
        <p>Thank You.</p>
        <p>Yours faithfully,</p>
        <Image
          src="/signature.png"
          alt="Signature"
          width={100}
          height={10}
          className="object-contain mt-2"
        />
      </div>
    </DocumentPreviewModal>
  );
}
