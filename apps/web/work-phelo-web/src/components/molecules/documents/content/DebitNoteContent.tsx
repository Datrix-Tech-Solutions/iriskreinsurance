'use client';

import { Facultative } from '@/types/reinsurance';
import { useCedants } from '@/hooks';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  DocumentContentFrame,
  DocumentField,
  DocumentIssueHeader,
} from '@/components/molecules/documents/DocumentContentFrame';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
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

function today(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const groupLabelStyle = {
  fontFamily: 'var(--doc-font-content)',
  marginTop: 'var(--doc-space-section)',
} as const;

export interface DebitNoteContentProps {
  note: UnknownRecord;
  placement?: Facultative;
  cedantName: string;
  /** Tenant display name, for the "Net Premium Due …" line. */
  companyName?: string | null;
  /** Document-profile bank accounts; filtered to the note's currency. */
  bankAccounts?: UnknownRecord[];
}

/** The cedant-facing debit note — content only, rendered with the shared
 *  document type system. The signatory block is supplied by the page template. */
export function DebitNoteContent({
  note,
  placement,
  cedantName,
  companyName,
  bankAccounts = [],
}: DebitNoteContentProps) {
  const { data: cedants = [] } = useCedants();

  const counterpartyId = text(record(note.counterparty).id || note.counterpartyId);
  const fullCedant = cedants.find(
    (c) => c.id === (counterpartyId !== '—' ? counterpartyId : placement?.cedant?.id),
  );
  const primaryAddress =
    fullCedant?.addresses?.find((a) => a.isPrimary) ?? fullCedant?.addresses?.[0];
  const cedantLocation = primaryAddress
    ? [primaryAddress.city, primaryAddress.state, primaryAddress.country].filter(Boolean).join(', ')
    : null;

  const currency =
    text(note.currency) !== '—' ? String(note.currency) : (placement?.currency ?? null);
  const grossAmount = numberValue(note.grossAmount);
  const commissionPct = numberValue(note.commissionPercent) ?? 0;
  const commissionAmt = numberValue(note.commissionAmount);
  const netAmount = numberValue(note.netAmount);

  // For a current-effective debit note (issued after an endorsement) the backend
  // carries the post-endorsement totals on the note itself. The base placement is
  // never mutated by endorsements, so `placement.premium` / `placement.facultativeOffer`
  // are stale — deriving the facultative share from them scales the percentage by
  // (effectivePremium / originalPremium). Prefer the snapshot's effective totals.
  const effectiveTotals = record(record(record(note.sourceSnapshot).effectiveView).effectiveTotals);
  const effectivePremium = numberValue(effectiveTotals.premium);
  const snapshotFacPct = numberValue(effectiveTotals.facultativeOfferPercent);

  const totalPremium = effectivePremium ?? placement?.premium ?? null;
  const impliedFacOffer =
    snapshotFacPct ??
    (totalPremium && grossAmount != null && totalPremium !== 0
      ? (grossAmount / totalPremium) * 100
      : (placement?.facultativeOffer ?? 0));

  const debitNo =
    text(note.noteNumber) !== '—'
      ? text(note.noteNumber)
      : displayPolicyNumber(placement?.policyNumber ?? null);
  const debitDate = note.noteDate ? fmtDateShort(note.noteDate) : today();
  const policyNumberDisplay = displayPolicyNumber(placement?.policyNumber ?? null);

  const filteredBankAccounts = bankAccounts.filter(
    (account) => !currency || text(account.currency) === currency,
  );
  const netPremiumLabel = companyName ? `Net Premium Due ${companyName}` : 'Net Premium Due';

  return (
    <DocumentContentFrame title="Debit Note">
      <DocumentIssueHeader
        referenceLabel="Debit No."
        reference={debitNo}
        date={debitDate}
        partyLabel="Bill To"
        partyName={cedantName}
        partyLocation={cedantLocation}
      />

      <p className="font-semibold text-gray-500" style={groupLabelStyle}>
        Description
      </p>
      <DocumentField label="Reinsured" value={cedantName} />
      <DocumentField label="Policy Type" value={text(placement?.classOfBusiness)} />
      <DocumentField label="Insured" value={text(placement?.title)} />
      <DocumentField label="Policy Number" value={policyNumberDisplay} />
      <DocumentField
        label="Policy Period"
        value={`${fmtDateShort(placement?.inceptionDate)} – ${fmtDateShort(placement?.expiryDate)}`}
      />
      <DocumentField label="Currency" value={currency} />

      <p className="font-semibold text-gray-500" style={groupLabelStyle}>
        Particulars
      </p>
      <DocumentField label="100% Gross Premium" value={fmtAmount(totalPremium, currency)} />
      <DocumentField
        label={`${impliedFacOffer.toFixed(2)}% Facultative Share`}
        value={fmtAmount(grossAmount, currency)}
      />
      <DocumentField
        label={`Less Commission ${commissionPct}%`}
        value={commissionAmt != null ? fmtAmount(commissionAmt, currency) : null}
      />
      <DocumentField label={netPremiumLabel} value={fmtAmount(netAmount, currency)} strong />

      <div
        className="flex flex-col gap-[1em]"
        style={{ fontFamily: 'var(--doc-font-content)', marginTop: 'var(--doc-space-section)' }}
      >
        <p className="text-center italic text-gray-600">Thank you for choosing us!</p>
        {filteredBankAccounts.length > 0 && (
          <div
            className="rounded-lg border border-gray-200 bg-gray-50 p-[1em] text-gray-700"
            style={{ fontSize: '0.9em', breakInside: 'avoid' }}
          >
            <p className="mb-[0.3em] font-semibold text-gray-900">Bank Account</p>
            {filteredBankAccounts.map((account, i) => (
              <p key={text(account.id) !== '—' ? text(account.id) : i}>
                {text(account.accountName)} · {text(account.bankName)}
                {account.branchName ? `, ${text(account.branchName)}` : ''} ·{' '}
                {text(account.currency)} {text(account.accountNumber)}
              </p>
            ))}
          </div>
        )}
        <p className="font-semibold text-gray-800" style={{ fontSize: '0.8em' }}>
          NOTE: COVER IS SUBJECT TO PREMIUM PAYMENT WARRANTY, PLEASE. WE WOULD THEREFORE APPRECIATE
          PAYMENT AS SOON AS POSSIBLE.
        </p>
      </div>
    </DocumentContentFrame>
  );
}
