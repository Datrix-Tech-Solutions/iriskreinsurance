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

interface OfferSlipPayload {
  documentType?: string;
  placement?: Record<string, unknown>;
  cedant?: Record<string, unknown>;
  businessEntries?: unknown[];
  offerEntries?: unknown[];
  debitGuaranteeFinancials?: Record<string, unknown>;
  participantPreview?: Record<string, unknown>;
  offerContext?: Record<string, unknown>;
  branding?: Record<string, unknown>;
  documentProfile?: Record<string, unknown>;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function calculatePercentAmount(
  amount: unknown,
  percent: unknown,
): number | null {
  const numericAmount = numberValue(amount);
  const numericPercent = numberValue(percent);
  if (numericAmount === null || numericPercent === null) return null;
  return (numericPercent / 100) * numericAmount;
}

function calculateNetPremium(
  premiumShare: unknown,
  commissionAmount: unknown,
  brokerageAmount: unknown,
): number | null {
  const premium = numberValue(premiumShare);
  const commission = numberValue(commissionAmount) ?? 0;
  const brokerage = numberValue(brokerageAmount) ?? 0;
  if (premium === null) return null;
  return premium - commission - brokerage;
}

function entryValue(entries: unknown[] | undefined, keys: string[]): unknown {
  for (const entry of entries ?? []) {
    const record = getRecord(entry);
    if (!record) continue;
    const key = typeof record.key === 'string' ? record.key.toLowerCase() : '';
    const label =
      typeof record.label === 'string' ? record.label.toLowerCase() : '';
    if (
      keys.some((candidate) => {
        const normalized = candidate.toLowerCase();
        return key === normalized || label === normalized;
      })
    ) {
      return record.value;
    }
  }
  return undefined;
}

function entryRows(title: string, entries: unknown[] | undefined): string {
  const rows = (entries ?? [])
    .map((entry) => {
      const record = getRecord(entry);
      if (!record) return '';
      return `
        <tr>
          <th>${text(record.label ?? record.key)}</th>
          <td>${text(record.value)}</td>
        </tr>
      `;
    })
    .join('');

  if (!rows) return '';

  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <table>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

export function renderOfferSlipTemplate(
  payload: OfferSlipPayload,
  context: PlacementDocumentTemplateContext,
): string {
  const placement = getRecord(payload.placement);
  const cedant = getRecord(payload.cedant);
  const participantPreview = getRecord(payload.participantPreview);
  const participant = getRecord(participantPreview?.participant);
  const reinsurer = getRecord(participant?.counterparty);
  const slipFinancials = getRecord(participantPreview?.slipFinancials);
  const distributionFinancials = getRecord(
    participantPreview?.distributionFinancials,
  );
  const offerContext = getRecord(payload.offerContext);
  const branding = getRecord(payload.branding);
  const profile = tenantDocumentProfile(payload.documentProfile);
  const brokerName =
    profile?.identity?.displayName ??
    profile?.identity?.legalName ??
    branding?.productName ??
    'Broker';
  const logoDataUri = profileAssetDataUri(profile?.branding ?? null, 'logo');
  const signatureDataUri = profileAssetDataUri(
    profile?.branding ?? null,
    'signature',
  );
  const primaryColor = profileColor(
    profile?.branding ?? null,
    'primaryColor',
    '#111827',
  );
  const contactLine = profileContactParts(profile?.contact ?? null)
    .map((part) => text(part))
    .join(' · ');

  const currency = placement?.currency;
  const policyNumber =
    placement?.policyNumber ??
    entryValue(payload.offerEntries, ['policyNumber', 'Policy Number']);
  const originalInsured = entryValue(payload.businessEntries, [
    'originalInsured',
    'Original Insured',
  ]);
  const risk =
    placement?.classOfBusiness ??
    placement?.riskType ??
    placement?.riskTypeId ??
    entryValue(payload.businessEntries, ['risk', 'Risk Type', 'Risk Class']);
  const premiumShare =
    distributionFinancials?.premiumShare ??
    distributionFinancials?.grossPremium;
  const brokerageAmount = distributionFinancials?.brokerageAmount;
  const snapshotNetPremium = distributionFinancials?.netPremium;
  const commissionAmount =
    distributionFinancials?.commissionAmount ??
    calculatePercentAmount(premiumShare, placement?.commission);
  const netPremium =
    snapshotNetPremium ??
    calculateNetPremium(premiumShare, commissionAmount, brokerageAmount);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(context.title)}</title>
    <style>
      @page { size: A4; margin: 22mm 18mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Helvetica Neue", Arial, sans-serif;
        color: #111827;
        background: #ffffff;
        font-size: 12px;
        line-height: 1.45;
      }
      .broker-logo {
        display: block;
        max-width: 150px;
        max-height: 58px;
        margin-bottom: 8px;
        object-fit: contain;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        border-bottom: 2px solid ${primaryColor};
        padding-bottom: 16px;
        margin-bottom: 24px;
      }
      .brand h1 {
        margin: 0;
        font-size: 20px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .broker-name { color: ${primaryColor}; font-weight: 700; }
      .brand p,
      .meta p {
        margin: 4px 0 0;
        color: #4b5563;
      }
      .meta {
        text-align: right;
        min-width: 180px;
      }
      .meta strong {
        display: block;
        font-size: 13px;
        color: #111827;
      }
      .section {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .section h2 {
        margin: 0 0 12px;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #374151;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 20px;
      }
      .detail dt {
        color: #6b7280;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .detail dd {
        margin: 3px 0 0;
        font-weight: 700;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        border-bottom: 1px solid #f3f4f6;
        padding: 10px 0;
      }
      th {
        color: #4b5563;
        font-weight: 600;
        text-align: left;
      }
      td {
        font-weight: 700;
        text-align: right;
      }
      .total th,
      .total td {
        border-bottom: 0;
        color: #047857;
        font-size: 14px;
      }
      .signature-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 28px;
        margin-top: 34px;
      }
      .signature-line {
        border-top: 1px solid #111827;
        padding-top: 8px;
        color: #4b5563;
      }
      .signature-image {
        display: block;
        max-width: 120px;
        max-height: 42px;
        margin: 5px 0;
        object-fit: contain;
      }
      footer {
        margin-top: 28px;
        padding-top: 14px;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 10px;
      }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">
        ${logoDataUri ? `<img class="broker-logo" src="${escapeHtml(logoDataUri)}" alt="${text(brokerName)} logo" />` : ''}
        <h1>Offer Slip</h1>
        <p class="broker-name">${text(brokerName)}</p>
        <p>Participant-specific facultative offer addressed to ${text(
          reinsurer?.name,
          'the selected reinsurer',
        )}.</p>
      </div>
      <div class="meta">
        <strong>${text(context.documentNumber)}</strong>
        <p>${text(placement?.reference)}</p>
        <p>Issued: ${dateText(context.generatedAt ?? new Date())}</p>
      </div>
    </header>

    <section class="section">
      <h2>Placement / Risk</h2>
      <div class="grid">
        ${detail('Cedant', text(cedant?.name))}
        ${detail('Reinsurer', text(reinsurer?.name))}
        ${detail('Policy Number', text(policyNumber))}
        ${detail('Original Insured', text(originalInsured))}
        ${detail('Risk', text(risk))}
        ${detail('Currency', text(currency))}
        ${detail('Insurance Period', `${dateText(placement?.inceptionDate)} - ${dateText(placement?.expiryDate)}`)}
      </div>
    </section>

    <section class="section">
      <h2>Offer Summary</h2>
      <div class="grid">
        ${detail('100% Sum Insured', moneyText(placement?.sumInsured, currency))}
        ${detail('100% Gross Premium', moneyText(placement?.premium, currency))}
        ${detail(
          'Facultative Offer',
          `${percentText(
            placement?.facultativeOffer ??
              slipFinancials?.facOffer ??
              slipFinancials?.facultativeOfferPct,
          )} / ${moneyText(
            slipFinancials?.facSumInsured ??
              slipFinancials?.facultativeOfferAmount,
            currency,
          )}`,
        )}
        ${detail(
          'Offered Line To Reinsurer',
          percentText(
            offerContext?.offeredLinePercent ??
              distributionFinancials?.offeredLinePct ??
              participant?.sharePercent,
          ),
        )}
      </div>
    </section>

    <section class="section">
      <h2>Financial Terms For This Offer</h2>
      <table>
        <tbody>
          <tr>
            <th>Reinsurer Gross Premium Share</th>
            <td>${moneyText(premiumShare, currency)}</td>
          </tr>
          <tr>
            <th>Commission (${percentText(placement?.commission)})</th>
            <td>${moneyText(commissionAmount, currency)}</td>
          </tr>
          <tr>
            <th>Brokerage (${percentText(distributionFinancials?.brokerageFee ?? distributionFinancials?.brokerageFeePct ?? participant?.brokerageFee)})</th>
            <td>${moneyText(brokerageAmount, currency)}</td>
          </tr>
          <tr class="total">
            <th>Net Premium</th>
            <td>${moneyText(netPremium, currency)}</td>
          </tr>
        </tbody>
      </table>
    </section>

    ${entryRows('Business Details', payload.businessEntries)}
    ${entryRows('Offer Details', payload.offerEntries)}

    <section class="section">
      <h2>Acceptance</h2>
      <p>
        Please review the facultative offer above and confirm your preferred signed line,
        subject to the terms and conditions shared by the broker.
      </p>
      <div class="signature-grid">
        <div class="signature-line">For ${text(reinsurer?.name)}</div>
        <div class="signature-line">
          ${signatureDataUri ? `<img class="signature-image" src="${escapeHtml(signatureDataUri)}" alt="Authorized signature" />` : ''}
          For ${text(brokerName)}
          ${profile ? `<br />${text(profile.signatory?.name, '')} ${text(profile.signatory?.title, '')}` : ''}
        </div>
      </div>
    </section>

    <footer>
      ${
        profile
          ? `${text(profile.footer?.text, '')}${profile.footer?.text && contactLine ? '<br />' : ''}${contactLine}`
          : 'This PDF was rendered from the immutable participant-scoped PlacementDocument.renderPayload. Source placement and participant records were not recalculated or mutated.'
      }
    </footer>
  </body>
</html>`;
}

export function isOfferSlipPayload(
  payload: unknown,
): payload is OfferSlipPayload {
  const record = getRecord(payload);
  const participantPreview = getRecord(record?.participantPreview);
  const participant = getRecord(participantPreview?.participant);
  return (
    record?.documentType === PlacementDocumentType.OFFER_SLIP &&
    getRecord(record.placement) !== null &&
    getRecord(record.cedant) !== null &&
    participant !== null &&
    getRecord(participant.counterparty) !== null
  );
}
