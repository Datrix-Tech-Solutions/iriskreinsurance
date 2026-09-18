'use client';

import Image from 'next/image';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative } from '@/types/reinsurance';
import { useCedants, useRiskTypes } from '@/hooks';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

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

interface DebitNoteModalProps {
  isOpen: boolean;
  placement: Facultative;
  /** Post-endorsement totals, when this placement has an endorsement in market. */
  facultativeOfferOverride?: number;
  premiumOverride?: number | null;
  commissionOverride?: number | null;
  onPrint: () => void;
  onClose: () => void;
}

export function DebitNoteModal({
  isOpen,
  placement,
  facultativeOfferOverride,
  premiumOverride,
  commissionOverride,
  onPrint,
  onClose,
}: DebitNoteModalProps) {
  const { data: cedants = [] } = useCedants();
  const { data: riskTypes = [] } = useRiskTypes();

  const {
    currency,
    facultativeOffer,
    premium,
    commission,
    classOfBusiness,
    title,
    policyNumber,
    inceptionDate,
    expiryDate,
    cedant,
    riskTypeId,
  } = placement;

  const riskTypeName = riskTypes.find((rt) => rt.id === riskTypeId)?.name ?? null;

  const fullCedant = cedants.find((c) => c.id === cedant.id);
  const primaryAddress =
    fullCedant?.addresses?.find((a) => a.isPrimary) ?? fullCedant?.addresses?.[0];
  const cedantLocation = primaryAddress
    ? [primaryAddress.city, primaryAddress.state, primaryAddress.country].filter(Boolean).join(', ')
    : null;

  const facOffer = facultativeOfferOverride ?? facultativeOffer ?? 0;
  const effectivePremium = premiumOverride ?? premium;
  const effectiveCommission = commissionOverride ?? commission;
  const facPremium = effectivePremium != null ? (facOffer / 100) * effectivePremium : null;
  const commissionAmt = facPremium != null ? ((effectiveCommission ?? 0) / 100) * facPremium : null;
  const netPremium =
    facPremium != null && commissionAmt != null ? facPremium - commissionAmt : null;

  const debitAfterContent = (
    <div className="mt-10 flex flex-col gap-6 border-t border-gray-200 pt-6">
      <p className="text-base text-gray-700 italic text-center">Thank you for choosing us!</p>

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

      <div
        className="flex flex-col gap-1 p-4 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700"
        style={{ breakInside: 'avoid' }}
      >
        <p className="font-semibold text-gray-900 mb-1">Bank Account</p>
        <p>iRisk Reinsurance Brokers Limited</p>
        <p>Access Bank PLC, Accra Newtown Branch</p>
        <p>GHS - 1036000007232 / USD - 1036000007233 / EUR - 1036000007235 / GBP - 1036000007236</p>
      </div>

      <p className="text-sm font-semibold text-gray-800 leading-relaxed">
        NOTE: COVER IS SUBJECT TO PREMIUM PAYMENT WARRANTY, PLEASE. WE WOULD THEREFORE APPRECIATE
        PAYMENT AS SOON AS POSSIBLE.
      </p>
    </div>
  );

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Debit Note — ${displayPolicyNumber(policyNumber)}`}
      documentTitle="Debit Note"
      fileName={buildDocumentFileName(
        'Debit Note',
        displayPolicyNumber(policyNumber),
        riskTypeName,
        title,
        `to ${cedant.name}`,
      )}
      onPrint={onPrint}
      onClose={onClose}
      afterContent={debitAfterContent}
    >
      <div className="flex flex-col gap-4 text-base">
        {/* Debit No / Date row */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-sm text-gray-400 uppercase tracking-wide">Debit No.</span>
            <p className="font-semibold text-gray-900">{displayPolicyNumber(policyNumber)}</p>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-400 uppercase tracking-wide">Date</span>
            <p className="font-semibold text-gray-900">{today()}</p>
          </div>
        </div>

        {/* Bill To */}
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-gray-400 uppercase tracking-wide">Bill To</span>
          <p className="font-semibold text-gray-900">{cedant.name}</p>
          {cedantLocation && <p className="text-gray-500">{cedantLocation}</p>}
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
              { label: '100% Gross Premium', value: fmtAmount(effectivePremium, currency) },
              {
                label: `${facOffer}% Facultative Share`,
                value: fmtAmount(facPremium, currency),
              },
              {
                label: `Less Commission ${effectiveCommission ?? 0}%`,
                value: commissionAmt != null ? fmtAmount(commissionAmt, currency) : '—',
              },
              {
                label: 'Net Premium Due iRisk Re',
                value: fmtAmount(netPremium, currency),
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
      </div>
    </DocumentPreviewModal>
  );
}
