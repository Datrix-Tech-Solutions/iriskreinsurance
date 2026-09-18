'use client';

import Image from 'next/image';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative } from '@/types/reinsurance';
import { useReinsurers, useRiskTypes } from '@/hooks';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

function fmtFieldValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null, currency: string | null) {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

interface CreditNoteRow {
  label: string;
  pct?: string;
  value?: string;
  bold?: boolean;
  divider?: boolean;
}

interface CreditNoteModalProps {
  isOpen: boolean;
  placement: Facultative;
  sharePercent: number;
  brokerageFee: number;
  counterpartyId: string;
  reinsurerCompany: string;
  nicLevyPct?: number;
  withholdingTaxPct?: number;
  /** Post-endorsement totals, when this placement has an endorsement in market. */
  sumInsuredOverride?: number | null;
  premiumOverride?: number | null;
  commissionOverride?: number | null;
  onPrint: () => void;
  onClose: () => void;
}

export function CreditNoteModal({
  isOpen,
  placement,
  sharePercent,
  brokerageFee,
  counterpartyId,
  reinsurerCompany,
  nicLevyPct = 0,
  withholdingTaxPct = 0,
  sumInsuredOverride,
  premiumOverride,
  commissionOverride,
  onPrint,
  onClose,
}: CreditNoteModalProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const { data: riskTypes = [] } = useRiskTypes();
  const reinsurer = reinsurers.find((r) => r.id === counterpartyId);
  const addr = reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];
  const reinsurerCity = addr?.city ?? null;
  const reinsurerRegionCountry = [addr?.state, addr?.country].filter(Boolean).join(' - ') || null;
  const {
    currency,
    sumInsured,
    premium,
    commission,
    classOfBusiness,
    title,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
    businessDetails,
    offerDetails,
    riskTypeId,
    description,
  } = placement;

  const riskTypeName = riskTypes.find((rt) => rt.id === riskTypeId)?.name ?? null;

  const riskDetailRows: CreditNoteRow[] = [
    ...placementDetailEntries(businessDetails),
    ...placementDetailEntries(offerDetails),
  ].map((entry) => ({ label: entry.label, value: fmtFieldValue(entry.value) }));

  const effectiveSumInsured = sumInsuredOverride ?? sumInsured;
  const effectivePremium = premiumOverride ?? premium;
  const effectiveCommission = commissionOverride ?? commission;

  const yourSumInsured =
    effectiveSumInsured != null ? (sharePercent / 100) * effectiveSumInsured : null;
  const yourPremium = effectivePremium != null ? (sharePercent / 100) * effectivePremium : null;
  const totalCommissionPct = (effectiveCommission ?? 0) + brokerageFee;
  const commissionAmt = yourPremium != null ? (totalCommissionPct / 100) * yourPremium : null;
  const nicLevyAmt = yourPremium != null ? (nicLevyPct / 100) * yourPremium : 0;
  const withholdingTaxAmt = yourPremium != null ? (withholdingTaxPct / 100) * yourPremium : 0;
  const netPremium =
    yourPremium != null && commissionAmt != null
      ? yourPremium - commissionAmt - nicLevyAmt - withholdingTaxAmt
      : null;

  const descriptionRows: CreditNoteRow[] = [
    { label: 'Reinsured', value: cedant.name },
    { label: 'Insured', value: title },
    { label: 'Policy Number', value: displayPolicyNumber(policyNumber) },
    { label: 'Class of Insurance', value: classOfBusiness ?? '—' },
    ...riskDetailRows,
    {
      label: 'Period of Insurance',
      value: `${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}`,
    },
    { label: 'Currency', value: currency ?? '—' },
  ];

  const financialRows: CreditNoteRow[] = [
    { label: 'Total Sum Insured', value: fmtAmount(effectiveSumInsured, currency) },
    { label: 'Total Premium', value: fmtAmount(effectivePremium, currency) },
    { label: 'Your Share', pct: `${sharePercent}%` },
    { label: 'Your Sum Insured', value: fmtAmount(yourSumInsured, currency) },
    { label: 'Your Premium', value: fmtAmount(yourPremium, currency) },
    {
      label: 'Less Commission',
      pct: `${totalCommissionPct}%`,
      value: fmtAmount(commissionAmt, currency),
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
    { label: '', divider: true },
    { label: 'Net Premium', value: fmtAmount(netPremium, currency), bold: true },
  ];

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Closings — ${displayPolicyNumber(policyNumber)}`}
      documentTitle="Closings"
      fileName={buildDocumentFileName(
        'Closings',
        displayPolicyNumber(policyNumber),
        riskTypeName,
        title,
        reinsurerCompany ? `to ${reinsurerCompany}` : null,
      )}
      afterContent={
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '14px',
            color: '#374151',
          }}
        >
          <p style={{ margin: 0 }}>Thank You.</p>
          <p style={{ margin: 0 }}>Yours faithfully,</p>
          <Image
            src="/signature.png"
            alt="Signature"
            width={100}
            height={10}
            style={{ objectFit: 'contain', marginTop: '8px', marginBottom: '4px' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>Nana Yaa Savage-Mensah</p>
            <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>Managing Director</p>
          </div>
        </div>
      }
      onPrint={onPrint}
      onClose={onClose}
    >
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
        <p className="text-gray-800">{reinsurerCompany}</p>
        {reinsurerCity && <p className="text-gray-600">{reinsurerCity}</p>}
        {reinsurerRegionCountry && <p className="text-gray-600">{reinsurerRegionCountry}</p>}
        <p className="font-medium text-gray-900 mt-2">Dear Sir/Madam</p>
        <p className="text-gray-700 mt-3 leading-relaxed">
          We refer to the risk below and your subsequent acceptance of a share of the same risk.
          Kindly issue your guarantee in accordance with the information below.
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
          {description && (
            <div data-print-block className="my-2">
              <p className="text-xs font-semibold text-gray-400  tracking-wide mb-1">
                Kindly Refer:
              </p>
              <div
                data-rich-text
                data-rich-text-doc
                className="text-base text-gray-700"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            </div>
          )}
        </tbody>
      </table>
    </DocumentPreviewModal>
  );
}
