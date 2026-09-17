'use client';

import Image from 'next/image';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative } from '@/types/reinsurance';
import { useReinsurers } from '@/hooks';
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

function today() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface PremiumCreditNoteModalProps {
  isOpen: boolean;
  placement: Facultative;
  sharePercent: number;
  brokerageFee: number;
  counterpartyId: string;
  reinsurerCompany: string;
  nicLevyPct?: number;
  withholdingTaxPct?: number;
  onPrint: () => void;
  onClose: () => void;
}

export function PremiumCreditNoteModal({
  isOpen,
  placement,
  sharePercent,
  brokerageFee,
  counterpartyId,
  reinsurerCompany,
  nicLevyPct = 0,
  withholdingTaxPct = 0,
  onPrint,
  onClose,
}: PremiumCreditNoteModalProps) {
  const { data: reinsurers = [] } = useReinsurers();
  const reinsurer = reinsurers.find((r) => r.id === counterpartyId);
  const primaryAddress =
    reinsurer?.addresses?.find((a) => a.isPrimary) ?? reinsurer?.addresses?.[0];
  const reinsurerLocation = primaryAddress
    ? [primaryAddress.city, primaryAddress.state, primaryAddress.country].filter(Boolean).join(', ')
    : null;

  const {
    currency,
    commission,
    premium,
    classOfBusiness,
    title,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
    businessDetails,
    offerDetails,
    description,
  } = placement;

  const offerDetailRows = [
    ...placementDetailEntries(businessDetails),
    ...placementDetailEntries(offerDetails),
  ].map((entry) => ({ label: entry.label, value: fmtFieldValue(entry.value) }));

  const grossPremium = premium ?? 0;
  const shareAmount = (sharePercent / 100) * grossPremium;
  const totalCommissionPct = (commission ?? 0) + brokerageFee;
  const commissionAmt = (totalCommissionPct / 100) * shareAmount;
  const nicLevyAmt = (nicLevyPct / 100) * shareAmount;
  const withholdingTaxAmt = (withholdingTaxPct / 100) * shareAmount;
  const premiumShareDue = shareAmount - commissionAmt - nicLevyAmt - withholdingTaxAmt;

  const creditAfterContent = (
    <div className="mt-10 flex flex-col gap-6 border-t border-gray-200 pt-6">
      <p className="text-base text-gray-700 italic text-center">
        Thank you for your continued partnership!
      </p>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">Signature / Stamp</span>
        <Image
          src="/signature.png"
          alt="Signature"
          width={160}
          height={80}
          className="object-contain mt-2"
        />
        <div className="w-64 border-b border-gray-400" />
      </div>
    </div>
  );

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Credit Note — ${displayPolicyNumber(policyNumber)}`}
      documentTitle="Credit Note"
      fileName={buildDocumentFileName(
        'Credit Note',
        displayPolicyNumber(policyNumber),
        title,
        reinsurerCompany ? `to ${reinsurerCompany}` : null,
      )}
      onPrint={onPrint}
      onClose={onClose}
      afterContent={creditAfterContent}
    >
      <div className="flex flex-col gap-4 text-base">
        {/* Credit No / Date row */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-sm text-gray-400 uppercase tracking-wide">Credit No.</span>
            <p className="font-semibold text-gray-900">{displayPolicyNumber(policyNumber)}</p>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-400 uppercase tracking-wide">Date</span>
            <p className="font-semibold text-gray-900">{today()}</p>
          </div>
        </div>

        {/* Pay To */}
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-gray-400 uppercase tracking-wide">Pay To</span>
          <p className="font-semibold text-gray-900">{reinsurerCompany}</p>
          {reinsurerLocation && <p className="text-gray-500">{reinsurerLocation}</p>}
        </div>

        {/* Table */}
        <table className="w-full border-collapse border border-gray-200 overflow-hidden text-base">
          <tbody>
            {/* Description heading */}
            <tr className="bg-blue-900">
              <td
                colSpan={2}
                className="py-2 px-4 text-center text-sm font-semibold text-gray-100 uppercase tracking-wide border-b border-blue-900"
              >
                Description
              </td>
            </tr>

            {[
              { label: 'Reinsured', value: cedant.name },
              { label: 'Policy Type', value: classOfBusiness ?? '—' },
            ].map((row) => (
              <tr key={row.label}>
                <td className="py-2 px-4 text-gray-500 w-1/2">{row.label}</td>
                <td className="py-2 px-4 text-right font-medium text-gray-900">{row.value}</td>
              </tr>
            ))}

            {[
              { label: 'Insured', value: title },
              { label: 'Policy Number', value: displayPolicyNumber(policyNumber) },
              {
                label: 'Policy Period',
                value: `${fmtDate(inceptionDate)} – ${fmtDate(expiryDate)}`,
              },
              { label: 'Currency', value: currency ?? '—' },
            ].map((row) => (
              <tr key={row.label}>
                <td className="py-2 px-4 text-gray-500 w-1/2">{row.label}</td>
                <td className="py-2 px-4 text-right font-medium text-gray-900">{row.value}</td>
              </tr>
            ))}

            {offerDetailRows.map((row) => (
              <tr key={row.label}>
                <td className="py-2 px-4 text-gray-500 w-1/2">{row.label}</td>
                <td className="py-2 px-4 text-right font-medium text-gray-900">{row.value}</td>
              </tr>
            ))}

            {/* Particulars heading */}
            <tr className="bg-blue-900">
              <td
                colSpan={2}
                className="py-2 px-4 text-center text-sm font-semibold text-gray-100 uppercase tracking-wide border-y border-blue-900"
              >
                Particulars
              </td>
            </tr>

            {[
              { label: '100% Gross Premium', value: fmtAmount(grossPremium, currency) },
              {
                label: `${sharePercent}% Participant Share`,
                value: fmtAmount(shareAmount, currency),
              },
              {
                label: `Less Commission ${totalCommissionPct}%`,
                value: fmtAmount(commissionAmt, currency),
              },
              ...(nicLevyPct > 0
                ? [{ label: `NIC Levy ${nicLevyPct}%`, value: fmtAmount(nicLevyAmt, currency) }]
                : []),
              ...(withholdingTaxPct > 0
                ? [
                    {
                      label: `Withholding Tax ${withholdingTaxPct}%`,
                      value: fmtAmount(withholdingTaxAmt, currency),
                    },
                  ]
                : []),
              {
                label: 'Premium Share Due',
                value: fmtAmount(premiumShareDue, currency),
                bold: true,
              },
            ].map((row) => (
              <tr key={row.label}>
                <td
                  className={`py-2 px-4 w-1/2 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
                >
                  {row.label}
                </td>
                <td
                  className={`py-2 px-4 text-right ${row.bold ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}
                >
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {description && (
          <div data-print-block>
            <p className="text-sm font-semibold text-gray-400  tracking-wide mb-1">Kindly Refer:</p>
            <div
              data-rich-text
              data-rich-text-doc
              className="text-base text-gray-700"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </div>
        )}
      </div>
    </DocumentPreviewModal>
  );
}
