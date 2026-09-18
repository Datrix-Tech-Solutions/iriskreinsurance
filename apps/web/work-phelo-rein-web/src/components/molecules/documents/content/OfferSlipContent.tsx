'use client';

import { Facultative } from '@/types/reinsurance';
import { useReinsurers } from '@/hooks';
import { useReinsuranceCharges } from '@/hooks/reinsurance/useReinsuranceCharges';
import { isForeignCedant, selectChargeRate } from '@/lib/reinsuranceTax';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  DocumentAcceptanceBlock,
  DocumentContentFrame,
  DocumentField,
} from '@/components/molecules/documents/DocumentContentFrame';

function fmtFieldValue(val: unknown): string {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function today(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null, currency: string | null): string {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

export interface OfferSlipContentProps {
  placement: Facultative;
  brokerageFee: number;
  counterpartyId?: string;
  /** Overrides placement.facultativeOffer — e.g. the capacity left after other
   *  participants have taken their share. */
  facultativeOfferOverride?: number;
}

/** The facultative offer slip — content only, rendered with the shared document
 *  type system. */
export function OfferSlipContent({
  placement,
  brokerageFee,
  counterpartyId,
  facultativeOfferOverride,
}: OfferSlipContentProps) {
  const {
    currency,
    facultativeOffer,
    sumInsured,
    premium,
    commission,
    rate,
    classOfBusiness,
    cedant,
    title,
    policyNumber,
    inceptionDate,
    expiryDate,
    businessDetails,
    offerDetails,
    description,
  } = placement;

  const { data: reinsurers = [] } = useReinsurers();
  const { data: charges } = useReinsuranceCharges();
  const reinsurer = reinsurers.find((r) => r.id === counterpartyId);
  const foreignReinsurer = isForeignCedant(reinsurer);
  const nicLevyRate = selectChargeRate(charges, 'NIC_LEVY', currency);
  const withholdingTaxRate = selectChargeRate(charges, 'WITHHOLDING_TAX', currency);

  const detailEntries = [
    ...placementDetailEntries(businessDetails),
    ...placementDetailEntries(offerDetails),
  ].filter((entry) => fmtFieldValue(entry.value) !== '—');

  const facOffer = facultativeOfferOverride ?? facultativeOffer ?? 0;
  const facSumInsured = sumInsured != null ? (facOffer / 100) * sumInsured : null;
  const reinsurancePremium = premium != null ? (facOffer / 100) * premium : null;
  const commissions =
    reinsurancePremium != null
      ? (((commission ?? 0) + brokerageFee) / 100) * reinsurancePremium
      : null;
  const netPremium =
    reinsurancePremium != null && commissions != null ? reinsurancePremium - commissions : null;
  const nicLevy =
    foreignReinsurer && reinsurancePremium != null
      ? reinsurancePremium * (nicLevyRate / 100)
      : null;
  const withholdingTax =
    foreignReinsurer && reinsurancePremium != null
      ? reinsurancePremium * (withholdingTaxRate / 100)
      : null;
  const netPremiumPayable =
    netPremium != null ? netPremium - (nicLevy ?? 0) - (withholdingTax ?? 0) : null;

  const hasFinancials =
    sumInsured != null ||
    rate != null ||
    premium != null ||
    facSumInsured != null ||
    reinsurancePremium != null;

  return (
    <DocumentContentFrame title="Facultative Reinsurance Slip">
      <DocumentField label="Date" value={today()} />
      <DocumentField label="Cover Type" value={classOfBusiness} />
      <DocumentField label="Reinsured" value={cedant.name} />
      <DocumentField label="Original Insured" value={title} />
      <DocumentField label="Policy Number" value={displayPolicyNumber(policyNumber)} />
      <DocumentField label="Currency" value={currency} />
      {(inceptionDate || expiryDate) && (
        <DocumentField
          label="Insurance Period"
          value={`${fmtDate(inceptionDate ?? '')} – ${fmtDate(expiryDate ?? '')}`}
        />
      )}

      {detailEntries.map((entry) => (
        <DocumentField key={entry.key} label={entry.label} value={fmtFieldValue(entry.value)} />
      ))}

      {hasFinancials && (
        <>
          <DocumentField
            label="100% Sum Insured"
            value={sumInsured != null ? fmtAmount(sumInsured, currency) : null}
          />
          <DocumentField label="Premium Rate" value={rate != null ? `${rate}%` : null} />
          <DocumentField
            label="100% Gross Premium"
            value={premium != null ? fmtAmount(premium, currency) : null}
          />
          <DocumentField
            label="Offer"
            value={
              facSumInsured != null ? `${fmtAmount(facSumInsured, currency)} (${facOffer}%)` : null
            }
          />
          <DocumentField
            label="Reinsurance Premium"
            value={reinsurancePremium != null ? fmtAmount(reinsurancePremium, currency) : null}
          />
          <DocumentField
            label="Reinsurance Commission"
            value={
              commissions != null
                ? `${fmtAmount(commissions, currency)} (${(commission ?? 0) + brokerageFee}%)`
                : null
            }
          />
          {nicLevy != null && withholdingTax != null && (
            <>
              <DocumentField
                label={`NIC Levy (${nicLevyRate}%)`}
                value={fmtAmount(nicLevy, currency)}
              />
              <DocumentField
                label={`Withholding Tax (${withholdingTaxRate}%)`}
                value={fmtAmount(withholdingTax, currency)}
              />
            </>
          )}
          <DocumentField
            label="Net Premium"
            value={netPremiumPayable != null ? fmtAmount(netPremiumPayable, currency) : null}
            strong
          />
        </>
      )}

      {description && (
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
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </div>
      )}

      <DocumentAcceptanceBlock />
    </DocumentContentFrame>
  );
}
