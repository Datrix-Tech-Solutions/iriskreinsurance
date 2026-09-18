'use client';

import { Facultative } from '@/types/reinsurance';
import { useReinsurers } from '@/hooks';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  DocumentAmountTable,
  DocumentContentFrame,
  DocumentSignature,
} from '@/components/molecules/documents/DocumentContentFrame';

type UnknownRecord = Record<string, unknown>;

interface NoteRow {
  label: string;
  pct?: string;
  value?: string;
  bold?: boolean;
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function fmtFieldValue(val: unknown): string {
  if (val == null || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtAmount(val: number | null, currency: string | null | undefined): string {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

function fmtDateShort(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return text(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function longToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export interface CreditNoteContentProps {
  note: UnknownRecord;
  placement?: Facultative;
  reinsurerCompany: string;
}

/** The reinsurer-facing "Closings" credit note — content only, rendered with the
 *  shared document type system. The signatory block comes from the page template. */
export function CreditNoteContent({ note, placement, reinsurerCompany }: CreditNoteContentProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const counterpartyId = text(record(note.counterparty).id || note.counterpartyId);
  const reinsurer = reinsurers.find((r) => r.id === counterpartyId);
  const addr = reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];
  const reinsurerCity = addr?.city ?? null;
  const reinsurerRegionCountry = [addr?.state, addr?.country].filter(Boolean).join(' - ') || null;

  const currency =
    text(note.currency) !== '—' ? String(note.currency) : (placement?.currency ?? null);
  const grossAmount = numberValue(note.grossAmount);
  const commissionPct = numberValue(note.commissionPercent) ?? 0;
  const commissionAmt = numberValue(note.commissionAmount) ?? 0;
  const brokeragePct = numberValue(note.brokeragePercent) ?? 0;
  const brokerageAmt = numberValue(note.brokerageAmount) ?? 0;
  const totalCommissionPct = commissionPct + brokeragePct;
  const totalCommissionAmt = commissionAmt + brokerageAmt;
  const nicLevyPct = numberValue(note.nicLevyPercent) ?? 0;
  const nicLevyAmt = numberValue(note.nicLevyAmount) ?? 0;
  const withholdingTaxPct = numberValue(note.withholdingTaxPercent) ?? 0;
  const withholdingTaxAmt = numberValue(note.withholdingTaxAmount) ?? 0;
  const netAmount = numberValue(note.netAmount);

  const totalPremium = placement?.premium ?? null;
  const totalSumInsured = placement?.sumInsured ?? null;
  const impliedSharePercent =
    totalPremium && grossAmount != null && totalPremium !== 0
      ? (grossAmount / totalPremium) * 100
      : null;
  const yourSumInsured =
    impliedSharePercent != null && totalSumInsured != null
      ? (impliedSharePercent / 100) * totalSumInsured
      : null;

  const riskDetailRows: NoteRow[] = [
    ...placementDetailEntries(placement?.businessDetails ?? null),
    ...placementDetailEntries(placement?.offerDetails ?? null),
  ].map((entry) => ({ label: entry.label, value: fmtFieldValue(entry.value) }));

  const descriptionRows: NoteRow[] = [
    { label: 'Reinsured', value: text(placement?.cedant?.name) },
    { label: 'Insured', value: text(placement?.title) },
    { label: 'Policy Number', value: displayPolicyNumber(placement?.policyNumber ?? null) },
    { label: 'Class of Insurance', value: text(placement?.classOfBusiness) },
    ...riskDetailRows,
    {
      label: 'Period of Insurance',
      value: `${fmtDateShort(placement?.inceptionDate)} – ${fmtDateShort(placement?.expiryDate)}`,
    },
    { label: 'Currency', value: currency ?? '—' },
  ];

  const financialRows: NoteRow[] = [
    { label: 'Total Sum Insured', value: fmtAmount(totalSumInsured, currency) },
    { label: 'Total Premium', value: fmtAmount(totalPremium, currency) },
    {
      label: 'Your Share',
      pct: impliedSharePercent != null ? `${impliedSharePercent.toFixed(2)}%` : '—',
    },
    { label: 'Your Sum Insured', value: fmtAmount(yourSumInsured, currency) },
    { label: 'Your Premium', value: fmtAmount(grossAmount, currency) },
    {
      label: 'Less Commission',
      pct: `${totalCommissionPct}%`,
      value: fmtAmount(totalCommissionAmt, currency),
    },
    ...(nicLevyPct > 0
      ? [{ label: 'NIC Levy', pct: `${nicLevyPct}%`, value: fmtAmount(nicLevyAmt, currency) }]
      : []),
    ...(withholdingTaxPct > 0
      ? [
          {
            label: 'Withholding Tax',
            pct: `${withholdingTaxPct}%`,
            value: fmtAmount(withholdingTaxAmt, currency),
          },
        ]
      : []),
    { label: 'Net Premium', value: fmtAmount(netAmount, currency), bold: true },
  ];

  return (
    <DocumentContentFrame title="Closings" showTitle={false}>
      <div
        className="flex flex-col gap-[0.3em]"
        style={{ fontFamily: 'var(--doc-font-content)', marginBottom: 'var(--doc-space-section)' }}
      >
        <p className="text-gray-500">{longToday()}</p>
        <p className="mt-[1em] text-gray-900">The Managing Director</p>
        <p className="text-gray-800">{reinsurerCompany}</p>
        {reinsurerCity && <p className="text-gray-600">{reinsurerCity}</p>}
        {reinsurerRegionCountry && <p className="text-gray-600">{reinsurerRegionCountry}</p>}
        <p className="mt-[1em] text-gray-900">Dear Sir/Madam</p>
        <p className="mt-[0.75em] leading-relaxed text-gray-700">
          We refer to the risk below and your subsequent acceptance of a share of the same risk.
          Kindly issue your guarantee in accordance with the information below.
        </p>
      </div>

      <DocumentAmountTable rows={[...descriptionRows, ...financialRows]} />

      {placement?.description && (
        <div
          data-print-block
          className="text-gray-700"
          style={{
            fontFamily: 'var(--doc-font-content)',
            marginTop: 'var(--doc-space-section)',
          }}
        >
          <p className="text-gray-400">Kindly Refer:</p>
          <div
            data-rich-text
            data-rich-text-doc
            dangerouslySetInnerHTML={{ __html: placement.description }}
          />
        </div>
      )}

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
