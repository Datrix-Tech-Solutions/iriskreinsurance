'use client';

import React from 'react';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative, PlacementDocument } from '@/types/reinsurance';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { useRiskTypes } from '@/hooks';

type UnknownRecord = Record<string, unknown>;

type FieldType = 'amount' | 'percent' | 'date' | 'text';

const CHANGE_FIELDS: { key: string; label: string; type: FieldType }[] = [
  { key: 'title', label: 'Insured', type: 'text' },
  { key: 'sumInsured', label: 'Sum Insured', type: 'amount' },
  { key: 'premium', label: 'Premium', type: 'amount' },
  { key: 'rate', label: 'Rate (%)', type: 'percent' },
  { key: 'facultativeOffer', label: 'Fac Offer %', type: 'percent' },
  { key: 'commission', label: 'Commission (%)', type: 'percent' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'inceptionDate', label: 'Inception Date', type: 'date' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
  { key: 'classOfBusiness', label: 'Class of Business', type: 'text' },
];

interface EndorsementDocumentModalProps {
  isOpen: boolean;
  document: PlacementDocument | null;
  /** Live placement, when available, supplies fields renderPayload doesn't carry (policy number, risk type). */
  placement?: Facultative;
  onClose: () => void;
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function list(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function getPayload(document: PlacementDocument | null): UnknownRecord {
  return record(document?.renderPayload);
}

function getPlacement(snapshot: unknown): UnknownRecord {
  const item = record(snapshot);
  return record(item.placement).id ? record(item.placement) : item;
}

function getSnapshotParticipants(snapshot: unknown): UnknownRecord[] {
  return list(record(snapshot).participants);
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

function toNum(value: unknown): number {
  return numberValue(value) ?? 0;
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

function fmtPercent(value: unknown): string {
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

function renderFieldVal(val: unknown, type: FieldType, currency: unknown): string {
  if (val == null || val === '') return '—';
  if (type === 'amount') return fmtMoney(toNum(val), currency);
  if (type === 'percent') return `${toNum(val)}%`;
  if (type === 'date') return fmtDate(val);
  return String(val);
}

function formatField(value: unknown, type: FieldType, currency: unknown) {
  if (type === 'amount') return fmtMoney(value, currency);
  if (type === 'percent') return fmtPercent(value);
  if (type === 'date') return fmtDate(value);
  return text(value);
}

function changedFieldRows(original: UnknownRecord, proposed: UnknownRecord) {
  return CHANGE_FIELDS.filter(({ key }) => {
    if (!(key in proposed)) return false;
    return String(original[key] ?? '') !== String(proposed[key] ?? '');
  });
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <p className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-1">
        {children}
      </p>
      <div className="border-t border-gray-300" />
    </div>
  );
}

function InfoRows({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <table className="w-full text-base border-collapse">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="py-1.5 pr-4 text-gray-500 w-2/5">{row.label}</td>
            <td className="py-1.5 pl-4 text-gray-900 font-medium">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function profileFromPayload(payload: UnknownRecord) {
  const profile = record(payload.documentProfile);
  const identity = record(profile.identity);
  const branding = record(profile.branding);
  const logo = record(branding.logo);
  const footer = record(profile.footer);
  const contact = record(profile.contact);
  const signatory = record(profile.signatory);

  return {
    displayName: text(identity.displayName || identity.legalName),
    logoSrc: typeof logo.dataUri === 'string' ? logo.dataUri : null,
    footerText: typeof footer.text === 'string' ? footer.text : null,
    contact,
    signatory,
  };
}

function DocumentFooter({ payload }: { payload: UnknownRecord }) {
  const profile = profileFromPayload(payload);
  return (
    <div className="mt-8 border-t border-gray-200 pt-4 text-sm text-gray-500">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-semibold text-gray-700">Authorized Signatory</p>
          <p>{text(profile.signatory.name)}</p>
          <p>{text(profile.signatory.title)}</p>
        </div>
        <div className="text-right">
          <p>{text(profile.contact.physicalAddress)}</p>
          <p>{text(profile.contact.phone)}</p>
          <p>{text(profile.contact.email)}</p>
        </div>
      </div>
      {profile.footerText && <p className="mt-3 text-center">{profile.footerText}</p>}
    </div>
  );
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
  const changed = changedFieldRows(original, proposed);
  if (changed.length === 0) {
    return <p className="text-base text-gray-400 italic">No revised placement terms recorded.</p>;
  }

  return (
    <table className="w-full text-base border-collapse">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="py-1.5 pr-3 text-left text-sm font-semibold text-gray-500">Field</th>
          <th className="py-1.5 px-3 text-left text-sm font-semibold text-gray-500">Original</th>
          <th className="py-1.5 pl-3 text-left text-sm font-semibold text-gray-500">Endorsed</th>
        </tr>
      </thead>
      <tbody>
        {changed.map((field) => (
          <tr key={field.key}>
            <td className="py-1.5 pr-3 text-gray-500">{field.label}</td>
            <td className="py-1.5 px-3 text-gray-700">
              {formatField(original[field.key], field.type, original.currency ?? currency)}
            </td>
            <td className="py-1.5 pl-3 text-gray-900 font-medium">
              {formatField(proposed[field.key], field.type, proposed.currency ?? currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ParticipationTable({ participants }: { participants: UnknownRecord[] }) {
  if (participants.length === 0) {
    return <p className="text-base text-gray-400 italic">No endorsement participants recorded.</p>;
  }

  return (
    <table className="w-full text-base border-collapse">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="py-1.5 pr-3 text-left text-sm font-semibold text-gray-500">Reinsurer</th>
          <th className="py-1.5 px-3 text-left text-sm font-semibold text-gray-500">Class</th>
          <th className="py-1.5 px-3 text-left text-sm font-semibold text-gray-500">Status</th>
          <th className="py-1.5 pl-3 text-right text-sm font-semibold text-gray-500">
            Accepted Line
          </th>
        </tr>
      </thead>
      <tbody>
        {participants.map((participant) => {
          const counterparty = record(participant.counterparty);
          const originalParticipant = record(participant.originalParticipant);
          const classification = originalParticipant.id ? 'REVISED' : 'ADDED';
          return (
            <tr key={text(participant.id)}>
              <td className="py-1.5 pr-3 text-gray-900 font-medium">
                {text(counterparty.name || participant.counterpartyId)}
              </td>
              <td className="py-1.5 px-3 text-gray-700">{classification}</td>
              <td className="py-1.5 px-3 text-gray-700">{text(participant.status)}</td>
              <td className="py-1.5 pl-3 text-right text-gray-900">
                {fmtPercent(participant.signedLinePercent ?? participant.sharePercent)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ConfirmedClosingsTable({ closings }: { closings: UnknownRecord[] }) {
  const confirmed = closings.filter((closing) => closing.status === 'CONFIRMED');
  if (confirmed.length === 0) {
    return <p className="text-base text-gray-400 italic">No confirmed endorsement closings yet.</p>;
  }

  return (
    <table className="w-full text-base border-collapse">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="py-1.5 pr-3 text-left text-sm font-semibold text-gray-500">Closing</th>
          <th className="py-1.5 px-3 text-left text-sm font-semibold text-gray-500">Reinsurer</th>
          <th className="py-1.5 px-3 text-right text-sm font-semibold text-gray-500">Line</th>
          <th className="py-1.5 pl-3 text-right text-sm font-semibold text-gray-500">
            Net Premium
          </th>
        </tr>
      </thead>
      <tbody>
        {confirmed.map((closing) => {
          const endorsementParticipant = record(closing.endorsementParticipant);
          const counterparty = record(endorsementParticipant.counterparty);
          return (
            <tr key={text(closing.id)}>
              <td className="py-1.5 pr-3 text-gray-900 font-medium">
                {text(closing.closingNumber)}
              </td>
              <td className="py-1.5 px-3 text-gray-700">{text(counterparty.name)}</td>
              <td className="py-1.5 px-3 text-right text-gray-700">
                {fmtPercent(closing.signedLinePercent)}
              </td>
              <td className="py-1.5 pl-3 text-right text-gray-900 font-medium">
                {fmtMoney(closing.netPremium, closing.currency)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function NoteRows({ notes }: { notes: UnknownRecord[] }) {
  if (notes.length === 0) return null;
  return (
    <>
      <SectionHeading>Financial Notes</SectionHeading>
      <InfoRows
        rows={notes.map((note) => ({
          label: text(note.noteNumber),
          value: `${text(note.type)} · ${text(note.status)} · ${fmtMoney(
            note.netAmount,
            note.currency,
          )}`,
        }))}
      />
    </>
  );
}

function DocumentControlRows({ document }: { document: PlacementDocument }) {
  return (
    <InfoRows
      rows={[
        { label: 'Document Number', value: document.documentNumber },
        { label: 'Version', value: `v${document.version}` },
        { label: 'Status', value: document.status },
        { label: 'Generated', value: fmtDate(document.generatedAt ?? document.createdAt) },
      ]}
    />
  );
}

// No persisted "official" format existed for this document before the backend started generating
// immutable endorsement-slip snapshots, so this view keeps the general-purpose layout.
function EndorsementSlipContent({ document }: { document: PlacementDocument }) {
  const payload = getPayload(document);
  const endorsement = record(payload.endorsement);
  const placement = record(endorsement.placement);
  const original = getPlacement(endorsement.originalSnapshot);
  const proposed = getPlacement(endorsement.proposedSnapshot);
  const participants = list(endorsement.participants);
  const closings = list(endorsement.closings);
  const notes = list(endorsement.notes);

  return (
    <>
      <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide pt-1 pb-2 text-center">
        Endorsement Slip
      </p>

      <SectionHeading>Document Control</SectionHeading>
      <DocumentControlRows document={document} />

      <SectionHeading>Policy Information</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Placement Reference', value: text(placement.reference) },
          { label: 'Cedant', value: text(record(placement.cedant).name) },
          { label: 'Insured', value: text(placement.title || proposed.title || original.title) },
          { label: 'Endorsement No.', value: text(endorsement.endorsementNumber) },
          { label: 'Endorsement Type', value: text(endorsement.type) },
          { label: 'Impact Type', value: text(endorsement.impactType) },
          { label: 'Effective Date', value: fmtDate(endorsement.effectiveDate) },
        ]}
      />

      <SectionHeading>Original vs Endorsed Business</SectionHeading>
      <ChangeTable original={original} proposed={proposed} currency={placement.currency} />

      <SectionHeading>Market Response</SectionHeading>
      <ParticipationTable participants={participants} />

      <SectionHeading>Confirmed Endorsement Closings</SectionHeading>
      <ConfirmedClosingsTable closings={closings} />

      <NoteRows notes={notes} />
      <DocumentFooter payload={payload} />
    </>
  );
}

/**
 * Reinsurer-facing endorsement certificate — Policy Information / Endorsement Summary
 * narrative / Original vs Revised participation (side by side) / Special Conditions,
 * sourced from the persisted document snapshot.
 */
function EndorsementCertificateContent({
  document,
  placement: livePlacement,
}: {
  document: PlacementDocument;
  placement?: Facultative;
}) {
  const payload = getPayload(document);
  const closing = record(payload.endorsementCertificate);
  const payloadPlacement = record(closing.placement);
  const endorsement = record(closing.endorsement);
  const endorsementParticipant = record(closing.endorsementParticipant);
  const counterparty = record(endorsementParticipant.counterparty);
  const reinsurerName = text(counterparty.name);
  const notes = list(closing.notes);

  const originalSnapshot = endorsement.originalSnapshot;
  const originalPlacement = getPlacement(originalSnapshot);
  const proposed = endorsement.proposedSnapshot ? getPlacement(endorsement.proposedSnapshot) : null;

  const originalParticipants = getSnapshotParticipants(originalSnapshot);
  const counterpartyId = text(endorsementParticipant.counterpartyId);
  const originalParticipant = originalParticipants.find(
    (p) => text(p.counterpartyId) === counterpartyId,
  );

  // Previous values (from the endorsement's original snapshot)
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

  // Revised (confirmed) values — read directly off the confirmed closing rather than
  // recomputed from share%, since the closing already holds the authoritative figures.
  const currency =
    text(payloadPlacement.currency) !== '—'
      ? text(payloadPlacement.currency)
      : text(closing.currency);
  const sharePercent = toNum(closing.signedLinePercent);
  const yourSumInsured = numberValue(closing.sumInsuredSnapshot) ?? 0;
  const yourPremium = numberValue(closing.premiumSnapshot) ?? 0;
  const commissionAmt = toNum(closing.commissionAmount) + toNum(closing.brokerageAmount);
  const netPremium = numberValue(closing.netPremium) ?? yourPremium - commissionAmt;

  const changedFields = proposed ? changedFieldRows(originalPlacement, proposed) : [];
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

  const policyNumberDisplay = livePlacement
    ? displayPolicyNumber(livePlacement.policyNumber)
    : text(payloadPlacement.reference);
  const insuredTitle = text(payloadPlacement.title || proposed?.title || originalPlacement.title);
  const classOfBusiness = text(payloadPlacement.classOfBusiness);

  const isConfirmed = closing.status === 'CONFIRMED' || Boolean(closing.confirmedAt);

  return (
    <>
      <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide pt-1 pb-2 text-center">
        Endorsement Certificate
      </p>

      <SectionHeading>Document Control</SectionHeading>
      <DocumentControlRows document={document} />

      {/* POLICY INFORMATION */}
      <SectionHeading>Policy Information</SectionHeading>
      <table className="w-full text-base border-collapse mb-2">
        <tbody>
          {[
            { label: 'Cedant', value: text(record(payloadPlacement.cedant).name) },
            { label: 'Reinsurer', value: reinsurerName },
            { label: 'Insured', value: insuredTitle },
            { label: 'Policy Number', value: policyNumberDisplay },
            { label: 'Endorsement No.', value: text(endorsement.endorsementNumber) },
            { label: 'Effective Date', value: fmtDate(endorsement.effectiveDate) },
            { label: 'Currency', value: currency || '—' },
            { label: 'Class of Business', value: classOfBusiness },
          ].map((row) => (
            <tr key={row.label}>
              <td className="py-1.5 pr-4 text-gray-500 w-2/5">{row.label}</td>
              <td className="py-1.5 pl-4 text-gray-900 font-medium">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ENDORSEMENT SUMMARY */}
      <SectionHeading>Endorsement Summary</SectionHeading>
      <div className="text-base mb-2 space-y-2">
        {Boolean(endorsement.reason) && (
          <div>
            <span className="text-gray-500">Reason:</span>
            <p className="text-gray-900 font-medium mt-0.5">{text(endorsement.reason)}</p>
          </div>
        )}
        {narrative ? (
          <p className="text-gray-800 leading-relaxed">{narrative}</p>
        ) : (
          <p className="text-gray-400 italic">No parameter changes recorded.</p>
        )}
      </div>

      {isConfirmed && (
        <>
          {/* REINSURER PARTICIPATION */}
          <SectionHeading>Reinsurer Participation</SectionHeading>
          <table className="w-full text-base border-collapse mb-2">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-1.5 pr-4 text-left text-sm font-semibold text-gray-500 w-1/3" />
                <th className="py-1.5 px-4 text-left text-sm font-semibold text-gray-500 w-1/3">
                  Original
                </th>
                <th className="py-1.5 pl-4 text-left text-sm font-semibold text-gray-500 w-1/3">
                  Revised
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: 'Your Participation %',
                  previous: prevShare ? `${prevShare}%` : 'no change',
                  revised: `${sharePercent}%`,
                  bold: false,
                },
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
              ].map((row) => (
                <tr key={row.label}>
                  <td
                    className={`py-1.5 pr-4 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
                  >
                    {row.label}
                  </td>
                  <td
                    className={`py-1.5 px-4 ${row.bold ? 'font-semibold text-gray-600' : 'text-gray-700'}`}
                  >
                    {row.previous}
                  </td>
                  <td
                    className={`py-1.5 pl-4 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-900'}`}
                  >
                    {row.revised}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* SPECIAL CONDITIONS */}
      <SectionHeading>Special Conditions</SectionHeading>
      <ul className="text-sm text-gray-700 space-y-1 list-none mb-2">
        <li>• All other terms remain unchanged.</li>
        <li>• This endorsement forms part of the original facultative slip.</li>
      </ul>

      <NoteRows notes={notes} />
      <DocumentFooter payload={payload} />
    </>
  );
}

export function EndorsementDocumentModal({
  isOpen,
  document,
  placement,
  onClose,
}: EndorsementDocumentModalProps) {
  const { data: riskTypes = [] } = useRiskTypes();

  if (!document) return null;

  const payload = getPayload(document);
  const profile = profileFromPayload(payload);
  const isCertificate = document.type === 'ENDORSEMENT_CERTIFICATE';
  const documentTitle = isCertificate ? 'Endorsement Certificate' : 'Endorsement Slip';
  const riskTypeName = placement
    ? (riskTypes.find((rt) => rt.id === placement.riskTypeId)?.name ?? null)
    : null;

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`${documentTitle} — ${document.documentNumber}`}
      documentTitle={documentTitle}
      fileName={buildDocumentFileName(
        documentTitle,
        placement ? displayPolicyNumber(placement.policyNumber) : document.documentNumber,
        riskTypeName,
        placement?.title,
      )}
      logoSrc={profile.logoSrc}
      companyName={profile.displayName}
      qrValue={`${document.documentNumber}:${document.version}:${document.status}`}
      onPrint={() => {}}
      onClose={onClose}
    >
      {isCertificate ? (
        <EndorsementCertificateContent document={document} placement={placement} />
      ) : (
        <EndorsementSlipContent document={document} />
      )}
    </DocumentPreviewModal>
  );
}
