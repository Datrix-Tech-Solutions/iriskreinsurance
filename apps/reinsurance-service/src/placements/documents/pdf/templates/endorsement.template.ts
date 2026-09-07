import { PlacementDocumentType } from '../../../../../prisma/generated/client';
import {
  dateText,
  detail,
  escapeHtml,
  getRecord,
  moneyText,
  percentText,
  PlacementDocumentTemplateContext,
  text,
} from './closing-slip.template';
import {
  profileAssetDataUri,
  profileColor,
  profileContactParts,
  tenantDocumentProfile,
} from './tenant-document-profile.template';

interface EndorsementSlipPayload {
  documentType?: string;
  endorsement?: Record<string, unknown>;
  documentProfile?: Record<string, unknown>;
}

interface EndorsementCertificatePayload {
  documentType?: string;
  endorsementCertificate?: Record<string, unknown>;
  documentProfile?: Record<string, unknown>;
}

const TERM_FIELDS: Array<{
  key: string;
  label: string;
  type: 'amount' | 'percent' | 'date' | 'text';
}> = [
  { key: 'title', label: 'Insured', type: 'text' },
  { key: 'sumInsured', label: 'Sum Insured', type: 'amount' },
  { key: 'premium', label: 'Gross Premium', type: 'amount' },
  { key: 'rate', label: 'Rate', type: 'percent' },
  { key: 'facultativeOffer', label: 'Facultative Offer', type: 'percent' },
  { key: 'commission', label: 'Commission', type: 'percent' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'inceptionDate', label: 'Inception Date', type: 'date' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
  { key: 'classOfBusiness', label: 'Class of Business', type: 'text' },
];

export function isEndorsementSlipPayload(
  value: unknown,
): value is EndorsementSlipPayload {
  const record = getRecord(value);
  return (
    !!record &&
    record.documentType === PlacementDocumentType.ENDORSEMENT_SLIP &&
    !!getRecord(record.endorsement)
  );
}

export function isEndorsementCertificatePayload(
  value: unknown,
): value is EndorsementCertificatePayload {
  const record = getRecord(value);
  return (
    !!record &&
    record.documentType === PlacementDocumentType.ENDORSEMENT_CERTIFICATE &&
    !!getRecord(record.endorsementCertificate)
  );
}

export function renderEndorsementSlipTemplate(
  payload: EndorsementSlipPayload,
  context: PlacementDocumentTemplateContext,
): string {
  const endorsement = getRecord(payload.endorsement);
  const placement = getRecord(endorsement?.placement);
  const cedant = getRecord(placement?.cedant);
  const participants = toRecords(endorsement?.participants);
  const closings = toRecords(endorsement?.closings).filter(
    (closing) => closing.status === 'CONFIRMED',
  );
  const notes = toRecords(endorsement?.notes);
  const original = snapshotPlacement(endorsement?.originalSnapshot);
  const proposed = snapshotPlacement(endorsement?.proposedSnapshot);
  const currency =
    placement?.currency ?? proposed?.currency ?? original?.currency ?? null;
  const totals = sumClosings(closings);

  return renderShell({
    title: 'Endorsement Slip',
    subtitle: `${text(endorsement?.endorsementNumber)} · ${text(placement?.reference)}`,
    context,
    documentProfile: payload.documentProfile,
    body: `
      <section class="letter">
        <p><strong>Placement:</strong> ${text(placement?.reference)} · ${text(placement?.title)}</p>
        <p><strong>Cedant:</strong> ${text(cedant?.name)}</p>
        <p>This document records the official endorsed changes to the placement. Original placement records remain historical and unchanged.</p>
      </section>
      <section class="section">
        <h2>Endorsement Details</h2>
        <div class="grid">
          ${detail('Endorsement No.', text(endorsement?.endorsementNumber))}
          ${detail('Endorsement Type', text(endorsement?.type))}
          ${detail('Impact Type', text(endorsement?.impactType))}
          ${detail('Status', text(endorsement?.status))}
          ${detail('Effective Date', dateText(endorsement?.effectiveDate))}
          ${detail('Document No.', text(context.documentNumber))}
        </div>
      </section>
      ${renderTermsTable(original, proposed, currency)}
      ${renderParticipantsTable(participants)}
      ${renderClosingsTable(closings, currency)}
      ${renderFinancialSummary(totals, currency, notes)}
      ${renderConditions(endorsement)}
      ${renderSignature(payload.documentProfile)}
    `,
  });
}

export function renderEndorsementCertificateTemplate(
  payload: EndorsementCertificatePayload,
  context: PlacementDocumentTemplateContext,
): string {
  const closing = getRecord(payload.endorsementCertificate);
  const endorsement = getRecord(closing?.endorsement);
  const placement = getRecord(closing?.placement);
  const cedant = getRecord(placement?.cedant);
  const participant = getRecord(closing?.endorsementParticipant);
  const reinsurer = getRecord(participant?.counterparty);
  const originalParticipant = getRecord(participant?.originalParticipant);
  const original = snapshotPlacement(endorsement?.originalSnapshot);
  const proposed = snapshotPlacement(endorsement?.proposedSnapshot);
  const currency =
    closing?.currency ?? placement?.currency ?? proposed?.currency ?? null;

  return renderShell({
    title: 'Endorsement Certificate',
    subtitle: `${text(reinsurer?.name)} · ${text(closing?.closingNumber)}`,
    context,
    documentProfile: payload.documentProfile,
    body: `
      <section class="letter">
        <p><strong>To:</strong> ${text(reinsurer?.name)}</p>
        <p><strong>Cedant:</strong> ${text(cedant?.name)}</p>
        <p>This certificate confirms the reinsurer's endorsed participation under the confirmed endorsement closing below.</p>
      </section>
      <section class="section">
        <h2>Certificate Details</h2>
        <div class="grid">
          ${detail('Placement Reference', text(placement?.reference))}
          ${detail('Endorsement No.', text(endorsement?.endorsementNumber))}
          ${detail('Closing No.', text(closing?.closingNumber))}
          ${detail('Effective Date', dateText(endorsement?.effectiveDate))}
          ${detail('Reinsurer', text(reinsurer?.name))}
          ${detail('Closing Status', text(closing?.status))}
        </div>
      </section>
      ${renderTermsTable(original, proposed, currency)}
      <section class="section">
        <h2>Confirmed Participation</h2>
        <table>
          <tbody>
            ${row('Original Signed Line', percentText(originalParticipant?.signedLinePercent ?? originalParticipant?.sharePercent))}
            ${row('Confirmed Endorsement Signed Line', percentText(closing?.signedLinePercent))}
            ${row('Share Percent', percentText(closing?.sharePercent))}
            ${row('Sum Insured Snapshot', moneyText(closing?.sumInsuredSnapshot, currency))}
            ${row('Gross Premium Snapshot', moneyText(closing?.premiumSnapshot, currency))}
            ${row('Commission', `${percentText(closing?.commissionPercent)} · ${moneyText(closing?.commissionAmount, currency)}`)}
            ${row('Brokerage', `${percentText(closing?.brokeragePercent)} · ${moneyText(closing?.brokerageAmount, currency)}`)}
            ${row('Net Premium', moneyText(closing?.netPremium, currency))}
          </tbody>
        </table>
      </section>
      ${renderNotesTable(toRecords(closing?.notes), currency)}
      ${renderConditions(endorsement)}
      ${renderSignature(payload.documentProfile)}
    `,
  });
}

function renderShell({
  title,
  subtitle,
  context,
  documentProfile,
  body,
}: {
  title: string;
  subtitle: string;
  context: PlacementDocumentTemplateContext;
  documentProfile: unknown;
  body: string;
}): string {
  const profile = tenantDocumentProfile(documentProfile);
  const brokerName =
    profile?.identity?.displayName ?? profile?.identity?.legalName;
  const logoDataUri = profileAssetDataUri(profile?.branding ?? null, 'logo');
  const primaryColor = profileColor(
    profile?.branding ?? null,
    'primaryColor',
    '#111827',
  );
  const contactLine = profileContactParts(profile?.contact ?? null)
    .map((part) => text(part))
    .join(' · ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(context.title)}</title>
    <style>
      @page { size: A4; margin: 22mm 18mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "Helvetica Neue", Arial, sans-serif; color: #111827; background: #fff; font-size: 12px; line-height: 1.45; }
      header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid ${primaryColor}; padding-bottom: 16px; margin-bottom: 22px; }
      .brand h1 { margin: 0; font-size: 20px; letter-spacing: .08em; text-transform: uppercase; }
      .broker-logo { display: block; max-width: 150px; max-height: 58px; margin-bottom: 8px; object-fit: contain; }
      .broker-name { color: ${primaryColor}; font-weight: 700; }
      .brand p, .meta p { margin: 4px 0 0; color: #4b5563; }
      .meta { text-align: right; min-width: 180px; }
      .meta strong { display: block; color: #111827; }
      .letter, .section { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
      .section h2 { margin: 0 0 12px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #374151; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; }
      .detail dt { color: #6b7280; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
      .detail dd { margin: 3px 0 0; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #f3f4f6; padding: 9px 0; }
      th { color: #4b5563; font-weight: 600; text-align: left; }
      td { font-weight: 700; text-align: right; }
      tr.changed th, tr.changed td { color: #b45309; }
      .total th, .total td { border-bottom: 0; color: ${primaryColor}; font-size: 14px; }
      .signature-block { margin-top: 28px; border-top: 1px solid #111827; padding-top: 8px; width: 48%; }
      footer { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 10px; color: #6b7280; font-size: 10px; text-align: center; }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">
        ${logoDataUri ? `<img class="broker-logo" src="${logoDataUri}" alt="Broker logo" />` : ''}
        <h1>${escapeHtml(title)}</h1>
        <p class="broker-name">${text(brokerName, 'Tenant document profile')}</p>
        <p>${text(subtitle)}</p>
      </div>
      <div class="meta">
        <strong>${text(context.documentNumber)}</strong>
        <p>Generated ${dateText(context.generatedAt)}</p>
      </div>
    </header>
    ${body}
    <footer>
      ${
        profile?.footer?.text || contactLine
          ? `${text(profile?.footer?.text, '')}${profile?.footer?.text && contactLine ? '<br />' : ''}${contactLine}`
          : 'Official Reinsurance Document'
      }
    </footer>
  </body>
</html>`;
}

function renderTermsTable(
  original: Record<string, unknown> | null,
  proposed: Record<string, unknown> | null,
  currency: unknown,
): string {
  const rows = TERM_FIELDS.map((field) => {
    const originalValue = original?.[field.key];
    const proposedValue = proposed?.[field.key] ?? originalValue;
    const changed =
      proposed &&
      proposed[field.key] !== undefined &&
      comparableValue(originalValue) !== comparableValue(proposedValue);
    return `<tr class="${changed ? 'changed' : ''}"><th>${escapeHtml(field.label)}</th><td>${formatValue(originalValue, field.type, currency)}</td><td>${formatValue(proposedValue, field.type, currency)}</td></tr>`;
  }).join('');

  return `<section class="section"><h2>Original and Revised Terms</h2><table><thead><tr><th>Field</th><th>Original</th><th>Revised</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderParticipantsTable(
  participants: Record<string, unknown>[],
): string {
  if (participants.length === 0) return '';
  const rows = participants
    .map((participant) => {
      const counterparty = getRecord(participant.counterparty);
      return `<tr><th>${text(counterparty?.name)}</th><td>${text(participant.status)}</td><td>${percentText(participant.sharePercent)}</td><td>${percentText(participant.signedLinePercent)}</td></tr>`;
    })
    .join('');
  return `<section class="section"><h2>Endorsement Participants</h2><table><thead><tr><th>Counterparty</th><th>Status</th><th>Offered Line</th><th>Signed Line</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderClosingsTable(
  closings: Record<string, unknown>[],
  currency: unknown,
): string {
  if (closings.length === 0) return '';
  const rows = closings
    .map((closing) => {
      const participant = getRecord(closing.endorsementParticipant);
      const counterparty = getRecord(participant?.counterparty);
      return `<tr><th>${text(closing.closingNumber)}</th><td>${text(counterparty?.name)}</td><td>${percentText(closing.signedLinePercent)}</td><td>${moneyText(closing.premiumSnapshot, currency)}</td><td>${moneyText(closing.netPremium, currency)}</td></tr>`;
    })
    .join('');
  return `<section class="section"><h2>Confirmed Endorsement Closings</h2><table><thead><tr><th>Closing</th><th>Reinsurer</th><th>Signed Line</th><th>Gross Premium</th><th>Net Premium</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderFinancialSummary(
  totals: {
    premium: number;
    commission: number;
    brokerage: number;
    net: number;
  },
  currency: unknown,
  notes: Record<string, unknown>[],
): string {
  return `<section class="section"><h2>Financial Summary</h2><table><tbody>${row('Gross Premium', moneyText(totals.premium, currency))}${row('Commission', moneyText(totals.commission, currency))}${row('Brokerage', moneyText(totals.brokerage, currency))}${row('Net Premium', moneyText(totals.net, currency), 'total')}${row('Linked Active Notes', text(notes.length))}</tbody></table></section>`;
}

function renderNotesTable(
  notes: Record<string, unknown>[],
  currency: unknown,
): string {
  if (notes.length === 0) return '';
  const rows = notes
    .map(
      (note) =>
        `<tr><th>${text(note.noteNumber)}</th><td>${text(note.type)}</td><td>${text(note.status)}</td><td>${moneyText(note.netAmount, note.currency ?? currency)}</td></tr>`,
    )
    .join('');
  return `<section class="section"><h2>Linked Notes</h2><table><thead><tr><th>Note</th><th>Type</th><th>Status</th><th>Net Amount</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderConditions(endorsement: Record<string, unknown> | null): string {
  const summary = endorsement?.changeSummary;
  if (!summary) return '';
  return `<section class="section"><h2>Change Summary</h2><p>${escapeHtml(JSON.stringify(summary, null, 2))}</p></section>`;
}

function renderSignature(documentProfile: unknown): string {
  const profile = tenantDocumentProfile(documentProfile);
  const signatoryName = profile?.signatory?.name;
  const signatoryTitle = profile?.signatory?.title;
  return `<div class="signature-block"><strong>${text(signatoryName, 'Authorized Signatory')}</strong><br />${text(signatoryTitle, 'For and on behalf of the broker')}</div>`;
}

function row(label: string, value: string, className = ''): string {
  return `<tr class="${className}"><th>${escapeHtml(label)}</th><td>${value}</td></tr>`;
}

function formatValue(
  value: unknown,
  type: 'amount' | 'percent' | 'date' | 'text',
  currency: unknown,
): string {
  if (type === 'amount') return moneyText(value, currency);
  if (type === 'percent') return percentText(value);
  if (type === 'date') return dateText(value);
  return text(value);
}

function snapshotPlacement(value: unknown): Record<string, unknown> | null {
  const record = getRecord(value);
  return getRecord(record?.placement) ?? record;
}

function comparableValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return value.toFixed(6);
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()) && value.includes('-')) {
      return date.toISOString().slice(0, 10);
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric.toFixed(6);
    return value;
  }
  return JSON.stringify(value);
}

function toRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value
        .map((item) => getRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

type ClosingTotals = {
  premium: number;
  commission: number;
  brokerage: number;
  net: number;
};

function sumClosings(closings: Record<string, unknown>[]): ClosingTotals {
  return closings.reduce<ClosingTotals>(
    (totals, closing) => ({
      premium: totals.premium + numeric(closing.premiumSnapshot),
      commission: totals.commission + numeric(closing.commissionAmount),
      brokerage: totals.brokerage + numeric(closing.brokerageAmount),
      net: totals.net + numeric(closing.netPremium),
    }),
    { premium: 0, commission: 0, brokerage: 0, net: 0 },
  );
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
