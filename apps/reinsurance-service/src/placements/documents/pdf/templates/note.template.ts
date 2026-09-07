import { PlacementDocumentType } from '../../../../../prisma/generated/client';
import {
  dateText,
  detail,
  escapeHtml,
  getRecord,
  moneyRow,
  moneyText,
  percentText,
  PlacementDocumentTemplateContext,
  text,
} from './closing-slip.template';
import {
  profileAssetDataUri,
  profileColor,
  profileContactParts,
  profileDefaultAccounts,
  tenantDocumentProfile,
} from './tenant-document-profile.template';

const NOTE_DOCUMENT_TYPES = new Set<PlacementDocumentType>([
  PlacementDocumentType.DEBIT_NOTE,
  PlacementDocumentType.CREDIT_NOTE,
  PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE,
  PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE,
]);

interface NoteDocumentPayload {
  documentType?: string;
  note?: Record<string, unknown>;
  branding?: Record<string, unknown>;
  documentProfile?: Record<string, unknown>;
}

type NotePresentation = {
  title: string;
  businessLabel: string;
  counterpartyLabel: string;
};

export function renderNoteTemplate(
  payload: NoteDocumentPayload,
  context: PlacementDocumentTemplateContext,
): string {
  const note = getRecord(payload.note);
  const branding = getRecord(payload.branding);
  const counterparty = getRecord(note?.counterparty);
  const placement = getRecord(note?.placement);
  const closing = getRecord(note?.closing);
  const endorsement = getRecord(note?.endorsement);
  const endorsementClosing = getRecord(note?.endorsementClosing);
  const presentation = notePresentation(payload.documentType);
  const currency = note?.currency;
  const closingNumber =
    closing?.closingNumber ?? endorsementClosing?.closingNumber;
  const productName = branding?.productName ?? 'Broker';
  const profile = tenantDocumentProfile(payload.documentProfile);
  const brokerName =
    profile?.identity?.displayName ??
    profile?.identity?.legalName ??
    productName;
  const logoDataUri = profileAssetDataUri(profile?.branding ?? null, 'logo');
  const signatureDataUri = profileAssetDataUri(
    profile?.branding ?? null,
    'signature',
  );
  const primaryColor = profileColor(
    profile?.branding ?? null,
    'primaryColor',
    '#173f5f',
  );
  const contactLine = profileContactParts(profile?.contact ?? null)
    .map((part) => text(part))
    .join(' · ');
  const bankAccounts = profileDefaultAccounts(profile?.banking ?? null).filter(
    (account) => account.currency === currency,
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(context.title)}</title>
    <style>
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Helvetica Neue", Arial, sans-serif;
        color: #172033;
        background: #ffffff;
        font-size: 12px;
        line-height: 1.45;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        border-bottom: 3px solid ${primaryColor};
        padding-bottom: 16px;
        margin-bottom: 22px;
      }
      .brand-mark {
        color: ${primaryColor};
        font-size: 22px;
        font-weight: 800;
        letter-spacing: 0.04em;
      }
      .broker-logo {
        display: block;
        max-width: 150px;
        max-height: 58px;
        margin-bottom: 6px;
        object-fit: contain;
      }
      .brand-copy {
        margin-top: 4px;
        color: #526174;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .document-heading {
        text-align: right;
      }
      .document-heading h1 {
        margin: 0;
        color: #172033;
        font-size: 21px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .document-heading p {
        margin: 5px 0 0;
        color: #526174;
      }
      .business-label {
        margin-bottom: 18px;
        border-left: 4px solid #d6a84b;
        background: #f8fafc;
        padding: 10px 12px;
        color: #334155;
      }
      .section {
        border: 1px solid #dfe5ec;
        border-radius: 8px;
        padding: 14px;
        margin-bottom: 14px;
        break-inside: avoid;
      }
      .section h2 {
        margin: 0 0 11px;
        color: #526174;
        font-size: 10px;
        letter-spacing: 0.11em;
        text-transform: uppercase;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 11px 20px;
      }
      .detail dt {
        color: #718096;
        font-size: 9px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .detail dd {
        margin: 3px 0 0;
        color: #172033;
        font-weight: 700;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        border-bottom: 1px solid #edf1f5;
        padding: 9px 0;
      }
      th {
        color: #526174;
        font-weight: 600;
        text-align: left;
      }
      td {
        color: #172033;
        font-weight: 700;
        text-align: right;
      }
      .deduction td {
        color: #9b2c2c;
      }
      .total th,
      .total td {
        border-top: 2px solid ${primaryColor};
        border-bottom: 0;
        color: ${primaryColor};
        font-size: 14px;
      }
      .signature-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 28px;
        margin-top: 34px;
      }
      .signature-box {
        min-height: 72px;
        border-top: 1px solid #64748b;
        padding-top: 7px;
        color: #526174;
        font-size: 10px;
      }
      .signature-box strong {
        display: block;
        margin-bottom: 3px;
        color: #172033;
        font-size: 11px;
      }
      .signature-image {
        display: block;
        max-width: 120px;
        max-height: 42px;
        margin-bottom: 5px;
        object-fit: contain;
      }
      footer {
        margin-top: 24px;
        border-top: 1px solid #dfe5ec;
        padding-top: 11px;
        color: #718096;
        font-size: 9px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <header>
      <div>
        ${logoDataUri ? `<img class="broker-logo" src="${escapeHtml(logoDataUri)}" alt="${text(brokerName)} logo" />` : ''}
        <div class="brand-mark">${text(brokerName)}</div>
        <div class="brand-copy">Reinsurance Operations</div>
      </div>
      <div class="document-heading">
        <h1>${escapeHtml(presentation.title)}</h1>
        <p>${text(note?.noteNumber)}</p>
        <p>Document: ${text(context.documentNumber)}</p>
      </div>
    </header>

    <div class="business-label">
      ${escapeHtml(presentation.businessLabel)}
    </div>

    <section class="section">
      <h2>Note Details</h2>
      <div class="grid">
        ${detail('Note Number', text(note?.noteNumber))}
        ${detail('Note Date', dateText(note?.noteDate))}
        ${detail('Status', text(note?.status))}
        ${detail('Payment Direction', directionText(note?.direction))}
        ${detail('Placement Reference', text(placement?.reference ?? note?.placementId))}
        ${detail('Policy / Risk', text(placement?.title))}
        ${detail('Closing Number', text(closingNumber))}
        ${detail('Endorsement', text(endorsement?.endorsementNumber))}
      </div>
    </section>

    <section class="section">
      <h2>${escapeHtml(presentation.counterpartyLabel)}</h2>
      <div class="grid">
        ${detail('Company', text(counterparty?.name))}
        ${detail('Registration Number', text(counterparty?.registrationNumber))}
        ${detail('Email', text(counterparty?.email))}
        ${detail('Country', text(counterparty?.country))}
      </div>
    </section>

    <section class="section">
      <h2>Financial Statement</h2>
      <table>
        <tbody>
          ${moneyRow('Gross Amount', note?.grossAmount, currency)}
          ${percentageMoneyRow(
            'Commission',
            note?.commissionPercent,
            note?.commissionAmount,
            currency,
          )}
          ${percentageMoneyRow(
            'Brokerage',
            note?.brokeragePercent,
            note?.brokerageAmount,
            currency,
          )}
          ${percentageMoneyRow(
            'NIC Levy',
            note?.nicLevyPercent,
            note?.nicLevyAmount,
            currency,
          )}
          ${percentageMoneyRow(
            'Withholding Tax',
            note?.withholdingTaxPercent,
            note?.withholdingTaxAmount,
            currency,
          )}
          <tr class="total">
            <th>Net Amount</th>
            <td>${moneyText(note?.netAmount, currency)}</td>
          </tr>
        </tbody>
      </table>
    </section>

    ${isDebitNote(payload.documentType) ? bankAccountSection(bankAccounts, currency) : ''}

    <div class="signature-grid">
      <div class="signature-box">
        ${signatureDataUri ? `<img class="signature-image" src="${escapeHtml(signatureDataUri)}" alt="Authorized signature" />` : ''}
        <strong>For ${text(brokerName)}</strong>
        ${profile ? `${text(profile.signatory?.name)}<br />${text(profile.signatory?.title)}` : 'Authorized signature / stamp'}
      </div>
      <div class="signature-box">
        <strong>Acknowledged by ${text(counterparty?.name, 'Recipient')}</strong>
        Name, signature and date
      </div>
    </div>

    <footer>
      ${
        profile
          ? `${text(profile.footer?.text, '')}${profile.footer?.text && contactLine ? '<br />' : ''}${contactLine}`
          : 'Official broker document rendered from an immutable PlacementDocument payload. No live placement, closing, endorsement or note values were recalculated.'
      }
    </footer>
  </body>
</html>`;
}

function isDebitNote(documentType: unknown): boolean {
  return (
    documentType === PlacementDocumentType.DEBIT_NOTE ||
    documentType === PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE
  );
}

function bankAccountSection(
  accounts: Record<string, unknown>[],
  currency: unknown,
): string {
  if (accounts.length === 0) return '';
  const rows = accounts
    .map(
      (account) => `
        <tr>
          <th>${text(account.bankName)}${account.branchName ? ` / ${text(account.branchName)}` : ''}</th>
          <td>
            ${text(account.accountName)}<br />
            ${text(account.accountNumber)}
            ${account.swiftCode ? `<br />SWIFT: ${text(account.swiftCode)}` : ''}
          </td>
        </tr>
      `,
    )
    .join('');
  return `
    <section class="section">
      <h2>Payment Instructions (${text(currency)})</h2>
      <table><tbody>${rows}</tbody></table>
    </section>
  `;
}

export function isNoteDocumentPayload(
  payload: unknown,
): payload is NoteDocumentPayload {
  const record = getRecord(payload);
  const note = getRecord(record?.note);
  if (
    !record ||
    !NOTE_DOCUMENT_TYPES.has(record.documentType as PlacementDocumentType) ||
    !note
  ) {
    return false;
  }

  const counterparty = getRecord(note.counterparty);
  return (
    note.type === record.documentType &&
    isNonEmptyString(note.noteNumber) &&
    isNonEmptyString(note.status) &&
    isNonEmptyString(note.direction) &&
    isNonEmptyString(note.currency) &&
    isDateValue(note.noteDate) &&
    isMoneyValue(note.grossAmount) &&
    isMoneyValue(note.netAmount) &&
    isNonEmptyString(counterparty?.name)
  );
}

function notePresentation(documentType: unknown): NotePresentation {
  switch (documentType) {
    case PlacementDocumentType.DEBIT_NOTE:
      return {
        title: 'Debit Note',
        businessLabel:
          'Broker to cedant premium request for confirmed placement closings.',
        counterpartyLabel: 'Cedant',
      };
    case PlacementDocumentType.CREDIT_NOTE:
      return {
        title: 'Credit Note',
        businessLabel:
          "Broker statement of the reinsurer's confirmed premium share and credit.",
        counterpartyLabel: 'Reinsurer',
      };
    case PlacementDocumentType.ENDORSEMENT_DEBIT_NOTE:
      return {
        title: 'Endorsement Debit Note',
        businessLabel:
          'Broker to cedant premium request for a confirmed placement update.',
        counterpartyLabel: 'Cedant',
      };
    case PlacementDocumentType.ENDORSEMENT_CREDIT_NOTE:
      return {
        title: 'Endorsement Credit Note',
        businessLabel:
          "Broker statement of the reinsurer's confirmed placement update share and credit.",
        counterpartyLabel: 'Reinsurer',
      };
    default:
      throw new Error('Unsupported note document type');
  }
}

function percentageMoneyRow(
  label: string,
  percent: unknown,
  amount: unknown,
  currency: unknown,
): string {
  const hasValue =
    amount !== null &&
    amount !== undefined &&
    amount !== '' &&
    Number(amount) !== 0;
  return `
    <tr${hasValue ? ' class="deduction"' : ''}>
      <th>${escapeHtml(label)} (${percentText(percent)})</th>
      <td>${moneyText(amount, currency)}</td>
    </tr>
  `;
}

function directionText(direction: unknown): string {
  const labels: Record<string, string> = {
    CEDANT_TO_BROKER: 'Cedant to Broker',
    BROKER_TO_REINSURER: 'Broker to Reinsurer',
    BROKER_TO_CEDANT: 'Broker to Cedant',
    REINSURER_TO_BROKER: 'Reinsurer to Broker',
  };
  const key = typeof direction === 'string' ? direction : '';
  return escapeHtml(labels[key] ?? (key || '—'));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDateValue(value: unknown): boolean {
  if (!isNonEmptyString(value) && !(value instanceof Date)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function isMoneyValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return isNonEmptyString(value) && Number.isFinite(Number(value));
}
