'use client';

import { Facultative, PlacementPayment } from '@/types/reinsurance';
import { useReinsurers, usePlacementPayments } from '@/hooks';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { premiumForeignSettlement } from '@/lib/reinsurance/premiumSettlement';
import {
  DocumentAmountTable,
  DocumentContentFrame,
  DocumentSignature,
} from '@/components/molecules/documents/DocumentContentFrame';

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
  if (val == null || Number.isNaN(val)) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

function fmtRate(val: number): string {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function parseCheque(p: PlacementPayment): { isCheque: boolean; chequeNumber: string | null } {
  const isCheque = p.settlementMethod === 'CHEQUE' || (p.notes ?? '').startsWith('Cheque payment');
  const parts = (p.reference ?? '').split(' — ').filter(Boolean);
  return { isCheque, chequeNumber: isCheque ? (parts[0] ?? null) : null };
}

function longToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export interface DisbursementAdviceContentProps {
  placement: Facultative;
  payment: PlacementPayment;
}

/** The reinsurer-facing disbursement advice — the "Closings" letter stripped to
 *  the date, the address and the details table. For REINSURER_DISBURSEMENT
 *  payments only. Content only; the signatory block is fixed branding. */
export function DisbursementAdviceContent({ placement, payment }: DisbursementAdviceContentProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const reinsurer = reinsurers.find((r) => r.id === payment.counterparty.id);
  const addr = reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];
  const reinsurerCity = addr?.city ?? null;
  const reinsurerRegionCountry = [addr?.state, addr?.country].filter(Boolean).join(' - ') || null;

  const {
    currency: placementCurrency,
    facultativeOffer,
    premium,
    commission,
    sumInsured,
    classOfBusiness,
    title,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
    businessDetails,
    offerDetails,
  } = placement;

  const currency = payment.currency ?? placementCurrency;
  const facOffer = facultativeOffer ?? 0;
  const facSumInsured = sumInsured != null ? (facOffer / 100) * sumInsured : null;
  const facPremium = premium != null ? (facOffer / 100) * premium : null;
  const commissionAmt = facPremium != null ? ((commission ?? 0) / 100) * facPremium : null;
  const paidAmount = parseFloat(payment.amount);

  // Every figure in this letter stays in the obligation currency. When the disbursement (or,
  // failing that, the cedant premium it stems from) settled in a single foreign currency, the
  // footnote states the rate that was applied — obligation = foreign × rate.
  const ownFx =
    payment.settlementCurrency &&
    payment.agreedExchangeRate &&
    payment.settlementCurrency !== payment.currency
      ? { currency: payment.settlementCurrency, rate: parseFloat(payment.agreedExchangeRate) }
      : null;
  const placementFx = premiumForeignSettlement(payments, currency);
  const advFx =
    ownFx && Number.isFinite(ownFx.rate) && ownFx.rate > 0
      ? ownFx
      : placementFx && placementFx.currency !== currency
        ? placementFx
        : null;

  const { isCheque, chequeNumber } = parseCheque(payment);

  const sameSource = (p: PlacementPayment) =>
    payment.closingId
      ? p.closingId === payment.closingId
      : payment.endorsementClosingId
        ? p.endorsementClosingId === payment.endorsementClosingId
        : true;
  const priorDisbursements = payments.filter(
    (p) =>
      p.id !== payment.id &&
      p.type === 'REINSURER_DISBURSEMENT' &&
      p.counterpartyId === payment.counterpartyId &&
      (p.status === 'BANK_CONFIRMED' || p.status === 'RECORDED') &&
      !p.reversalOfPaymentId &&
      sameSource(p) &&
      new Date(p.createdAt).getTime() < new Date(payment.createdAt).getTime(),
  );
  const priorTotal = priorDisbursements.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const hasPrior = priorTotal > 0.01;

  const netPremiumTarget = parseFloat(
    payment.closing?.netPremium ?? payment.endorsementClosing?.netPremium ?? '',
  );
  const clearsBalance = Number.isFinite(netPremiumTarget)
    ? priorTotal + paidAmount >= netPremiumTarget - 0.01
    : true;

  // The sentence quotes the money that actually moved: if the disbursement settled in a
  // foreign currency, show that; the footnote then states the rate back to the obligation
  // currency. The detail table above stays in the obligation currency.
  const footnoteCurrency = advFx ? advFx.currency : currency;
  const toFootnote = (obligationValue: number) =>
    advFx ? obligationValue / advFx.rate : obligationValue;

  const amountText = fmtAmount(toFootnote(paidAmount), footnoteCurrency);
  const chequePhrase = chequeNumber
    ? `to be paid with our Access Bank cheque number ${chequeNumber}`
    : 'to be paid with our Access Bank cheque';
  const transferPhrase = 'to be transferred to your bank';
  const methodPhrase = isCheque ? chequePhrase : transferPhrase;

  let leadText: string;
  let priorNote: string | null = null;
  if (hasPrior && clearsBalance) {
    leadText = 'Kindly find attached final payment in the amount of ';
    const priorText = fmtAmount(toFootnote(priorTotal), footnoteCurrency);
    if (isCheque) {
      const priorCheques = priorDisbursements
        .map((p) => parseCheque(p).chequeNumber)
        .filter((n): n is string => !!n);
      const how = priorCheques.length
        ? `with cheque number ${priorCheques.join(', ')}`
        : 'by cheque';
      priorNote = ` Note that an initial payment of ${priorText} was made ${how}.`;
    } else {
      priorNote = ` Note that an initial payment of ${priorText} was transferred to your bank.`;
    }
  } else if (!hasPrior && clearsBalance) {
    leadText = 'Kindly find attached payment in the amount of ';
  } else {
    leadText = 'Kindly find attached initial payment in the amount of ';
  }

  const paymentSentence = (
    <>
      {leadText}
      <strong>{amountText}</strong> {methodPhrase}.{priorNote}
      {advFx && (
        <>
          {' '}
          Converted at an exchange rate of{' '}
          <strong>
            1 {advFx.currency}: {currency ?? ''} {fmtRate(advFx.rate)}
          </strong>
          .
        </>
      )}
    </>
  );

  const riskDetailRows: Row[] = [
    ...placementDetailEntries(businessDetails),
    ...placementDetailEntries(offerDetails),
  ].map((entry) => ({ label: entry.label, value: fmtFieldValue(entry.value) }));

  const descriptionRows: Row[] = [
    { label: 'Reinsured', value: cedant.name },
    { label: 'Insured', value: title ?? '—' },
    { label: 'Policy Number', value: displayPolicyNumber(policyNumber) },
    { label: 'Class of Insurance', value: classOfBusiness ?? '—' },
    ...riskDetailRows,
    { label: 'Period of Insurance', value: `${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}` },
    { label: 'Currency', value: currency ?? '—' },
  ];

  const financialRows: Row[] = [
    { label: 'Your Share', pct: `${facOffer}%` },
    { label: 'Your Sum Insured', value: fmtAmount(facSumInsured, currency) },
    { label: 'Your Premium', value: fmtAmount(facPremium, currency) },
    {
      label: 'Less Commission',
      pct: `${commission ?? 0}%`,
      value: fmtAmount(commissionAmt, currency),
    },
    { label: 'Net Premium', value: fmtAmount(paidAmount, currency), bold: true },
  ];

  return (
    <DocumentContentFrame title="Disbursement Advice" showTitle={false}>
      <div
        className="flex flex-col gap-[0.3em]"
        style={{ fontFamily: 'var(--doc-font-content)', marginBottom: 'var(--doc-space-section)' }}
      >
        <p className="text-gray-500">{longToday()}</p>
        <p className="mt-[1em] text-gray-900">The Managing Director</p>
        <p className="text-gray-800">{payment.counterparty.name}</p>
        {reinsurerCity && <p className="text-gray-600">{reinsurerCity}</p>}
        {reinsurerRegionCountry && <p className="text-gray-600">{reinsurerRegionCountry}</p>}
      </div>

      <p
        className="text-center font-semibold text-gray-900 underline"
        style={{
          fontFamily: 'var(--doc-font-header)',
          marginBottom: 'var(--doc-space-section)',
        }}
      >
        PAYMENT ADVICE
      </p>

      <DocumentAmountTable rows={[...descriptionRows, ...financialRows]} />

      <p
        className="text-gray-800"
        style={{ fontFamily: 'var(--doc-font-content)', marginTop: 'var(--doc-space-section)' }}
      >
        {paymentSentence}
      </p>

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
