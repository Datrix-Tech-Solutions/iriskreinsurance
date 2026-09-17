'use client';

import React from 'react';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  DocumentContentFrame,
  DocumentField,
  DocumentSectionHeader,
} from '@/components/molecules/documents/DocumentContentFrame';
import { OfferSlipContent } from '@/components/molecules/documents/content/OfferSlipContent';
import {
  EndorsementParticipantClosing,
  Facultative,
  PlacementEndorsement,
  PlacementEndorsementParticipant,
  PlacementEndorsementSummary,
  PlacementNote,
} from '@/types/reinsurance';
import { useRiskTypes } from '@/hooks';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

interface EndorsementSlipPreviewModalProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement: PlacementEndorsement;
  participants: PlacementEndorsementParticipant[];
  closings: EndorsementParticipantClosing[];
  notes: PlacementNote[];
  summary?: PlacementEndorsementSummary;
  documentTitle?: string;
  focusedCounterpartyId?: string | null;
  focusedRecipient?: {
    name: string;
    relationship: string;
    offeredLinePercent: string | number;
    status: string;
  } | null;
  /** 'OFFER_SLIP' — brand-new market participant, rendered like the original placement's
   *  Offer Slip. 'REVISED_CERTIFICATE' — existing participant reviewing revised terms
   *  (Original vs Proposed/Revised participation), computed live. Titled "Endorsement Offer
   *  Slip" pre-close, or "Endorsement Certificate" once `confirmedClosing` is supplied — same
   *  live rendering either way, just sourced from confirmed closing figures instead of the
   *  in-flight offer. Not to be confused with the whole-endorsement "Endorsement Slip"
   *  overview document (EndorsementHeader/generic branch below), which covers every
   *  participant rather than one reinsurer. */
  previewFormat?: 'OFFER_SLIP' | 'REVISED_CERTIFICATE';
  brokerageFee?: number;
  /** Confirmed closing for this participant — when set, REVISED_CERTIFICATE renders as the
   *  post-close "Endorsement Certificate" using these authoritative figures. */
  confirmedClosing?: EndorsementParticipantClosing | null;
  onClose: () => void;
}

type FieldType = 'amount' | 'percent' | 'date' | 'text';

const CHANGE_FIELDS: {
  key: string;
  label: string;
  type: 'amount' | 'percent' | 'date' | 'text';
}[] = [
  { key: 'title', label: 'Insured', type: 'text' },
  { key: 'sumInsured', label: 'Sum Insured', type: 'amount' },
  { key: 'premium', label: 'Premium', type: 'amount' },
  { key: 'rate', label: 'Rate', type: 'percent' },
  { key: 'facultativeOffer', label: 'Facultative Offer', type: 'percent' },
  { key: 'commission', label: 'Commission', type: 'percent' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'inceptionDate', label: 'Inception Date', type: 'date' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
  { key: 'classOfBusiness', label: 'Class of Business', type: 'text' },
];

type UnknownRecord = Record<string, unknown>;

function getSnapshotPlacement(snapshot: Record<string, unknown>): Record<string, unknown> {
  if (snapshot.placement && typeof snapshot.placement === 'object') {
    return snapshot.placement as Record<string, unknown>;
  }
  return snapshot;
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return text(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fmtPct(value: unknown): string {
  const numeric = numberValue(value);
  return numeric === null ? '—' : `${numeric.toLocaleString()}%`;
}

function fmtMoney(value: unknown, currency?: unknown): string {
  const numeric = numberValue(value);
  if (numeric === null) return '—';
  return `${currency ? `${currency} ` : ''}${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatField(
  value: unknown,
  type: (typeof CHANGE_FIELDS)[number]['type'],
  currency: unknown,
) {
  if (type === 'amount') return fmtMoney(value, currency);
  if (type === 'percent') return fmtPct(value);
  if (type === 'date') return fmtDate(value);
  return text(value);
}

// Risk/offer detail fields (schema-driven risk details + custom "extra" fields) aren't flat
// scalars on the snapshot — they live nested under businessDetails/offerDetails, so they need
// their own extraction/diff pass alongside CHANGE_FIELDS.
function detailEntryMap(record: UnknownRecord): Map<string, { label: string; value: unknown }> {
  const businessDetails = (record.businessDetails ?? null) as Record<string, unknown> | null;
  const offerDetails = (record.offerDetails ?? null) as Record<string, unknown> | null;
  const map = new Map<string, { label: string; value: unknown }>();
  for (const entry of [
    ...placementDetailEntries(businessDetails),
    ...placementDetailEntries(offerDetails),
  ]) {
    map.set(entry.key, { label: entry.label, value: entry.value });
  }
  return map;
}

function ChangeTable({
  original,
  proposed,
  currency,
}: {
  original: UnknownRecord;
  proposed: UnknownRecord;
  currency: unknown;
}) {
  const changed = CHANGE_FIELDS.filter(({ key }) => {
    if (!(key in proposed)) return false;
    return String(original[key] ?? '') !== String(proposed[key] ?? '');
  });

  const originalDetails = detailEntryMap(original);
  const proposedDetails = detailEntryMap(proposed);
  const changedDetailFields = Array.from(
    new Set([...originalDetails.keys(), ...proposedDetails.keys()]),
  )
    .map((key) => ({
      key,
      label: (proposedDetails.get(key) ?? originalDetails.get(key))!.label,
    }))
    .filter(
      ({ key }) =>
        String(originalDetails.get(key)?.value ?? '') !==
        String(proposedDetails.get(key)?.value ?? ''),
    );

  if (changed.length === 0 && changedDetailFields.length === 0) {
    return <p className="italic">No revised placement terms recorded.</p>;
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="py-[0.4em] pr-2 text-left font-semibold">Field</th>
          <th className="px-2 py-[0.4em] text-left font-semibold">Original</th>
          <th className="py-[0.4em] pl-2 text-left font-semibold">Endorsed</th>
        </tr>
      </thead>
      <tbody>
        {changed.map((field) => (
          <tr key={field.key} className="border-b border-gray-100">
            <td className="py-[0.4em] pr-2">{field.label}</td>
            <td className="px-2 py-[0.4em]">
              {formatField(original[field.key], field.type, original.currency ?? currency)}
            </td>
            <td className="py-[0.4em] pl-2">
              {formatField(proposed[field.key], field.type, proposed.currency ?? currency)}
            </td>
          </tr>
        ))}
        {changedDetailFields.map(({ key, label }) => (
          <tr key={key} className="border-b border-gray-100">
            <td className="py-[0.4em] pr-2">{label}</td>
            <td className="px-2 py-[0.4em]">{text(originalDetails.get(key)?.value)}</td>
            <td className="py-[0.4em] pl-2">{text(proposedDetails.get(key)?.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function getSnapshotParticipants(snapshot: Record<string, unknown>): Record<string, unknown>[] {
  const ps = snapshot.participants;
  return Array.isArray(ps) ? (ps as Record<string, unknown>[]) : [];
}

function toNum(val: unknown): number {
  if (val == null) return 0;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(n) ? 0 : n;
}

function renderFieldVal(val: unknown, type: FieldType, currency: unknown): string {
  if (val == null || val === '') return '—';
  if (type === 'amount') return fmtMoney(toNum(val), currency);
  if (type === 'percent') return `${toNum(val)}%`;
  if (type === 'date') return fmtDate(val);
  return String(val);
}

function buildChangeSentence(
  changedFields: { key: string; label: string; type: FieldType }[],
  originalPlacement: UnknownRecord,
  proposed: UnknownRecord,
  effectiveDate: unknown,
  prevCurrency: unknown,
  currency: unknown,
): React.ReactNode {
  if (changedFields.length === 0) return null;

  const clauses: React.ReactNode[] = changedFields.map(({ key, label, type }) => {
    const prev = originalPlacement[key];
    const curr = proposed[key];
    const prevStr = renderFieldVal(prev, type, prevCurrency);
    const currStr = renderFieldVal(curr, type, currency);
    let verb = 'changed';
    if (type === 'amount' || type === 'percent') {
      verb = toNum(curr) > toNum(prev) ? 'increased' : 'decreased';
    }
    return (
      <React.Fragment key={key}>
        the {label.toLowerCase()} was {verb} from <strong>{prevStr}</strong> to{' '}
        <strong>{currStr}</strong>
      </React.Fragment>
    );
  });

  const joined: React.ReactNode[] = [];
  clauses.forEach((clause, i) => {
    if (i > 0) {
      joined.push(
        <React.Fragment key={`sep-${i}`}>
          {i === clauses.length - 1 ? ', and ' : ', '}
        </React.Fragment>,
      );
    }
    joined.push(clause);
  });

  return (
    <>
      Effective from <strong>{fmtDate(effectiveDate)}</strong>, {joined}.
    </>
  );
}

/**
 * Content for an existing participant reviewing revised endorsement terms — a live-computed
 * "Endorsement Offer Slip" pre-close pitch, or an "Endorsement Certificate" once
 * `confirmedClosing` is supplied, in which case the "Revised" figures come straight from that
 * closing's authoritative numbers instead of being estimated from the in-flight offer.
 */
function RevisedOfferContent({
  placement,
  endorsement,
  counterpartyId,
  reinsurerName,
  sharePercent,
  brokerageFee,
  confirmedClosing,
}: {
  placement: Facultative;
  endorsement: PlacementEndorsement;
  counterpartyId: string;
  reinsurerName: string;
  sharePercent: number;
  brokerageFee: number;
  confirmedClosing?: EndorsementParticipantClosing | null;
}) {
  const originalPlacement = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  const originalParticipants = getSnapshotParticipants(endorsement.originalSnapshot);
  const originalParticipant = originalParticipants.find(
    (p) => text(p.counterpartyId) === counterpartyId,
  );

  // Previous values
  const prevShare = toNum(
    originalParticipant?.signedLinePercent ?? originalParticipant?.sharePercent,
  );
  const prevBrokerage = toNum(originalParticipant?.brokerageFee);
  const prevPremium = toNum(originalPlacement.premium);
  const prevSumInsured = toNum(originalPlacement.sumInsured);
  const prevCommission = toNum(originalPlacement.commission);
  const prevCurrency = text(originalPlacement.currency);
  const prevYourPremium = (prevShare / 100) * prevPremium;
  const prevYourSumInsured = (prevShare / 100) * prevSumInsured;
  const prevCommissionAmt = ((prevCommission + prevBrokerage) / 100) * prevYourPremium;
  const prevNetPremium = prevYourPremium - prevCommissionAmt;

  // Revised values — once the participant's closing is confirmed, its own figures are
  // authoritative (this is the "Endorsement Certificate" case). Until then, estimate from
  // this endorsement's proposed terms (not the live placement record, which won't reflect
  // the endorsement's figures until it's actually closed), falling back to the current
  // placement only if there's no proposed snapshot at all.
  const currency = confirmedClosing
    ? text(confirmedClosing.currency ?? placement.currency)
    : text(proposed?.currency ?? placement.currency);
  const yourPremium = confirmedClosing
    ? toNum(confirmedClosing.premiumSnapshot)
    : (sharePercent / 100) * toNum(proposed?.premium ?? placement.premium);
  const yourSumInsured = confirmedClosing
    ? toNum(confirmedClosing.sumInsuredSnapshot)
    : (sharePercent / 100) * toNum(proposed?.sumInsured ?? placement.sumInsured);
  const commissionAmt = confirmedClosing
    ? toNum(confirmedClosing.commissionAmount) + toNum(confirmedClosing.brokerageAmount)
    : ((toNum(proposed?.commission ?? placement.commission) + brokerageFee) / 100) * yourPremium;
  const netPremium = confirmedClosing
    ? toNum(confirmedClosing.netPremium)
    : yourPremium - commissionAmt;

  const changedFields = proposed
    ? CHANGE_FIELDS.filter(({ key }) => {
        const prev = originalPlacement[key];
        const curr = proposed[key];
        return curr !== undefined && String(prev ?? '') !== String(curr ?? '');
      })
    : [];

  const narrative =
    proposed && changedFields.length > 0
      ? buildChangeSentence(
          changedFields,
          originalPlacement,
          proposed,
          endorsement.effectiveDate,
          prevCurrency,
          currency,
        )
      : null;

  const participationRows = [
    ...(confirmedClosing
      ? [
          {
            label: 'Your Participation %',
            previous: `${prevShare}%`,
            revised: `${toNum(confirmedClosing.signedLinePercent)}%`,
            bold: false,
          },
        ]
      : []),
    {
      label: 'Your Share SI',
      previous: fmtMoney(prevYourSumInsured || null, prevCurrency),
      revised: fmtMoney(yourSumInsured, currency),
      bold: false,
    },
    {
      label: 'Your Gross Premium',
      previous: fmtMoney(prevYourPremium || null, prevCurrency),
      revised: fmtMoney(yourPremium, currency),
      bold: false,
    },
    {
      label: 'Your Commission',
      previous: fmtMoney(prevCommissionAmt || null, prevCurrency),
      revised: fmtMoney(commissionAmt, currency),
      bold: false,
    },
    {
      label: 'Your Net Premium',
      previous: fmtMoney(prevNetPremium || null, prevCurrency),
      revised: fmtMoney(netPremium, currency),
      bold: true,
    },
  ];

  return (
    <DocumentContentFrame
      title={confirmedClosing ? 'Endorsement Certificate' : 'Endorsement Offer Slip'}
    >
      <DocumentSectionHeader>Policy Information</DocumentSectionHeader>
      <DocumentField label="Cedant" value={placement.cedant.name} />
      <DocumentField label="Reinsurer" value={reinsurerName} />
      <DocumentField label="Insured" value={text(placement.title)} />
      <DocumentField label="Policy Number" value={displayPolicyNumber(placement.policyNumber)} />
      <DocumentField label="Endorsement No." value={endorsement.endorsementNumber} />
      <DocumentField label="Effective Date" value={fmtDate(endorsement.effectiveDate)} />
      <DocumentField label="Currency" value={text(placement.currency)} />
      <DocumentField label="Class of Business" value={text(placement.classOfBusiness)} />

      <DocumentSectionHeader>Endorsement Summary</DocumentSectionHeader>
      <div className="flex flex-col gap-2">
        {narrative ? <p>{narrative}</p> : <p className="italic">No parameter changes recorded.</p>}
        {Boolean(endorsement.reason) && <p>Comment: {endorsement.reason}</p>}
      </div>

      {proposed && (
        <>
          <DocumentSectionHeader>Original vs Endorsed Business</DocumentSectionHeader>
          <ChangeTable original={originalPlacement} proposed={proposed} currency={currency} />
        </>
      )}

      <DocumentSectionHeader>Reinsurer Participation</DocumentSectionHeader>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="w-1/3 py-[0.4em] pr-2 text-left font-semibold">
              {confirmedClosing ? '' : `Your Participation (${prevShare}%)`}
            </th>
            <th className="w-1/3 py-[0.4em] px-2 text-left font-semibold">Original</th>
            <th className="w-1/3 py-[0.4em] pl-2 text-left font-semibold">
              {confirmedClosing ? 'Revised' : 'Endorsed'}
            </th>
          </tr>
        </thead>
        <tbody>
          {participationRows.map((row) => (
            <tr key={row.label} className="border-b border-gray-100">
              <td className={`py-[0.4em] pr-2 ${row.bold ? 'font-semibold' : ''}`}>{row.label}</td>
              <td className={`py-[0.4em] px-2 ${row.bold ? 'font-semibold' : ''}`}>
                {row.previous}
              </td>
              <td className={`py-[0.4em] pl-2 ${row.bold ? 'font-semibold' : ''}`}>
                {row.revised}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <DocumentSectionHeader>Special Conditions</DocumentSectionHeader>
      <ul className="list-none space-y-1">
        <li>• All other terms remain unchanged.</li>
        <li>• This endorsement forms part of the original facultative slip.</li>
      </ul>
    </DocumentContentFrame>
  );
}

/**
 * Content for a brand-new endorsement market offer — mirrors the original placement's
 * SlipPreviewModal layout exactly, just sourced from the endorsement's current (proposed)
 * terms instead of the original placement snapshot, and offered at this recipient's line.
 */
export function EndorsementSlipPreviewModal({
  isOpen,
  placement,
  endorsement,
  participants,
  closings,
  notes,
  summary,
  documentTitle = 'Endorsement Slip Preview',
  focusedCounterpartyId,
  focusedRecipient,
  previewFormat,
  brokerageFee = 0,
  confirmedClosing,
  onClose,
}: EndorsementSlipPreviewModalProps) {
  const { data: riskTypes = [] } = useRiskTypes();
  const riskTypeName = placement.riskTypeId
    ? (riskTypes.find((rt) => rt.id === placement.riskTypeId)?.name ?? null)
    : null;

  const original = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = getSnapshotPlacement(endorsement.proposedSnapshot ?? {});
  const confirmedClosings = closings.filter((closing) => closing.status === 'CONFIRMED');
  const focusedParticipant = focusedCounterpartyId
    ? participants.find((participant) => participant.counterpartyId === focusedCounterpartyId)
    : undefined;
  const focusedReinsurerName =
    focusedRecipient?.name ??
    focusedParticipant?.counterparty?.name ??
    focusedParticipant?.counterpartyId ??
    null;

  if (previewFormat === 'OFFER_SLIP') {
    const offeredLinePercent = Number(focusedRecipient?.offeredLinePercent ?? 0);
    return (
      <DocumentPreviewShell
        isOpen={isOpen}
        title={`${documentTitle} — ${placement.title}`}
        fileName={buildDocumentFileName(
          documentTitle,
          displayPolicyNumber(placement.policyNumber),
          riskTypeName,
          placement.title,
          focusedReinsurerName ? `to ${focusedReinsurerName}` : null,
        )}
        printRootId="endorsement-offer-slip-print-root"
        onClose={onClose}
      >
        <OfferSlipContent
          placement={placement}
          counterpartyId={focusedCounterpartyId ?? undefined}
          facultativeOfferOverride={Number.isFinite(offeredLinePercent) ? offeredLinePercent : 0}
          brokerageFee={brokerageFee}
        />
      </DocumentPreviewShell>
    );
  }

  if (previewFormat === 'REVISED_CERTIFICATE') {
    const sharePercent = Number(focusedRecipient?.offeredLinePercent ?? 0);
    const docTitle = confirmedClosing ? 'Endorsement Certificate' : 'Endorsement Offer Slip';
    return (
      <DocumentPreviewShell
        isOpen={isOpen}
        title={`${docTitle} — ${endorsement.endorsementNumber}`}
        fileName={buildDocumentFileName(
          docTitle,
          displayPolicyNumber(placement.policyNumber),
          riskTypeName,
          placement.title,
          focusedReinsurerName ? `to ${focusedReinsurerName}` : null,
        )}
        printRootId="endorsement-certificate-print-root"
        onClose={onClose}
      >
        <RevisedOfferContent
          placement={placement}
          endorsement={endorsement}
          counterpartyId={focusedCounterpartyId ?? ''}
          reinsurerName={focusedReinsurerName ?? ''}
          sharePercent={Number.isFinite(sharePercent) ? sharePercent : 0}
          brokerageFee={brokerageFee}
          confirmedClosing={confirmedClosing}
        />
      </DocumentPreviewShell>
    );
  }

  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={documentTitle}
      fileName={buildDocumentFileName(
        documentTitle,
        displayPolicyNumber(placement.policyNumber),
        riskTypeName,
        placement.title,
        `endorsement ${endorsement.endorsementNumber}`,
      )}
      printRootId="endorsement-slip-print-root"
      onClose={onClose}
    >
      <DocumentContentFrame title={documentTitle}>
        <DocumentSectionHeader>Endorsement</DocumentSectionHeader>
        <DocumentField label="Policy Number" value={displayPolicyNumber(placement.policyNumber)} />
        <DocumentField label="Insured" value={placement.title} />
        <DocumentField label="Endorsement Number" value={endorsement.endorsementNumber} />
        <DocumentField label="Effective Date" value={fmtDate(endorsement.effectiveDate)} />
        <DocumentField label="Reason" value={text(endorsement.reason)} />

        <DocumentSectionHeader>Original vs Proposed Business</DocumentSectionHeader>
        <ChangeTable original={original} proposed={proposed} currency={placement.currency} />

        {(focusedParticipant || focusedRecipient) && (
          <>
            <DocumentSectionHeader>Market Recipient</DocumentSectionHeader>
            <DocumentField
              label="Reinsurer"
              value={
                focusedRecipient?.name ??
                focusedParticipant?.counterparty?.name ??
                focusedParticipant?.counterpartyId ??
                '—'
              }
            />
            <DocumentField
              label="Relationship"
              value={
                focusedRecipient?.relationship ??
                (focusedParticipant?.originalParticipantId
                  ? 'Existing placement participant reviewing revised terms'
                  : 'New endorsement participant reviewing current endorsed risk')
              }
            />
            <DocumentField
              label="Offered / Revised Line"
              value={fmtPct(
                focusedRecipient?.offeredLinePercent ??
                  focusedParticipant?.signedLinePercent ??
                  focusedParticipant?.sharePercent,
              )}
            />
            <DocumentField
              label="Response Status"
              value={focusedRecipient?.status ?? focusedParticipant?.status ?? '—'}
            />
          </>
        )}

        <DocumentSectionHeader>Capacity Summary</DocumentSectionHeader>
        <DocumentField
          label="Target Capacity"
          value={summary?.targetPercent == null ? null : `${summary.targetPercent}%`}
        />
        <DocumentField
          label="Accepted Capacity"
          value={summary ? `${summary.acceptedPercent}%` : null}
        />
        <DocumentField
          label="Confirmed Capacity"
          value={summary ? `${summary.placedPercent}%` : null}
        />
        <DocumentField
          label="Remaining Capacity"
          value={summary?.remainingPercent == null ? null : `${summary.remainingPercent}%`}
        />

        <DocumentSectionHeader>Endorsement Participants</DocumentSectionHeader>
        {participants.length === 0 ? (
          <p className="italic">No endorsement participants recorded.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-[0.4em] pr-2 text-left font-semibold">Reinsurer</th>
                <th className="py-[0.4em] px-2 text-left font-semibold">Offer Share</th>
                <th className="py-[0.4em] px-2 text-left font-semibold">Net Premium</th>
                <th className="py-[0.4em] pl-2 text-left font-semibold">Added/Revised</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => {
                const closing = confirmedClosings.find(
                  (item) =>
                    item.endorsementParticipant.counterpartyId === participant.counterpartyId,
                );
                return (
                  <tr key={participant.id} className="border-b border-gray-100">
                    <td className="py-[0.4em] pr-2">
                      {participant.counterparty?.name ?? participant.counterpartyId}
                    </td>
                    <td className="py-[0.4em] px-2">
                      {fmtPct(participant.signedLinePercent ?? participant.sharePercent)}
                    </td>
                    <td className="py-[0.4em] px-2">
                      {closing ? fmtMoney(closing.netPremium, closing.currency) : '—'}
                    </td>
                    <td className="py-[0.4em] pl-2">
                      {participant.originalParticipantId ? 'Revised' : 'Added'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {notes.length > 0 && (
          <>
            <DocumentSectionHeader>Endorsement Notes</DocumentSectionHeader>
            {notes.map((note) => (
              <DocumentField
                key={note.noteNumber}
                label={note.noteNumber}
                value={`${note.type} · ${note.status} · Net ${fmtMoney(
                  note.netAmount,
                  note.currency,
                )}`}
              />
            ))}
          </>
        )}
      </DocumentContentFrame>
    </DocumentPreviewShell>
  );
}
