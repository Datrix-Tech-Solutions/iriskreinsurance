'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormSection } from '@/components/atoms/FormSection';
import { DetailField } from '@/components/atoms/DetailField';
import { RichTextView } from '@/components/molecules/shared/RichTextView';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';
import { useFacultativePlacement } from '@/hooks';
import { PaymentWorklistRow } from '@/types/reinsurance';

interface ViewOfferPanelProps {
  isOpen: boolean;
  /** Worklist row for the offer being viewed. Its effective-terms fields overlay the base
   * placement values so the panel matches the row the user clicked. */
  row: PaymentWorklistRow | null;
  onClose: () => void;
}

function fmtFieldValue(val: unknown): string {
  if (val == null || val === '') return '—';
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

// Read-only mirror of the Partial Edit panel — every field is shown as plain detail,
// nothing is editable. Used from the payments worklist "View Offer" action.
export function ViewOfferPanel({ isOpen, row, onClose }: ViewOfferPanelProps) {
  const { data: placement, isLoading, isError } = useFacultativePlacement(row?.placementId ?? '');

  // Endorsements amend the policy without touching the base placement record, so overlay the
  // effective terms from the worklist row (which fall back to base values when no endorsement
  // applies) — keeps this panel in step with the row the user clicked.
  const effectiveSumInsured = row?.effectiveSumInsured ?? placement?.sumInsured ?? null;
  const effectivePremium = row?.effectivePremium ?? placement?.premium ?? null;
  const effectiveFacultativeOffer =
    row?.effectiveFacultativeOfferPercent ?? placement?.facultativeOffer ?? null;
  // Rate is a base-slip attribute — there is no endorsement-adjusted rate, so it stays as entered.

  const riskEntries = placement
    ? [
        ...placementDetailEntries(placement.businessDetails),
        ...placementDetailEntries(placement.offerDetails),
      ]
    : [];

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Facultative Offer"
      description={
        placement ? displayPolicyNumber(placement.policyNumber) || placement.reference : undefined
      }
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          Loading offer…
        </div>
      ) : isError || !placement ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          Unable to load this offer.
        </div>
      ) : (
        <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
          <FormSection title="Policy Details">
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Insurance Company" value={placement.cedant.name} />
              <DetailField label="Risk Type" value={placement.classOfBusiness ?? '—'} />
            </div>
          </FormSection>

          {riskEntries.length > 0 && (
            <FormSection title="Risk Details">
              <div className="grid grid-cols-2 gap-3">
                {riskEntries.map((entry) => (
                  <DetailField
                    key={entry.key}
                    label={entry.label}
                    value={fmtFieldValue(entry.value)}
                  />
                ))}
              </div>
            </FormSection>
          )}

          <FormSection title="Offer Details">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3">
                <DetailField
                  label="Policy Number"
                  value={displayPolicyNumber(placement.policyNumber) || '—'}
                />
                <DetailField label="Insured" value={placement.title} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailField
                  label="100% Sum Insured"
                  value={fmtAmount(effectiveSumInsured, placement.currency)}
                />
                <DetailField
                  label="Rate (%)"
                  value={placement.rate != null ? `${placement.rate}%` : '—'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailField
                  label="100% Premium"
                  value={fmtAmount(effectivePremium, placement.currency)}
                />
                <DetailField
                  label="Facultative Offer (%)"
                  value={effectiveFacultativeOffer != null ? `${effectiveFacultativeOffer}%` : '—'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailField
                  label="Cedant Commission (%)"
                  value={placement.commission != null ? `${placement.commission}%` : '—'}
                />
                <DetailField label="Currency" value={placement.currency ?? '—'} />
              </div>
            </div>
          </FormSection>

          <FormSection title="Period of Insurance">
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Inception" value={fmtDate(placement.inceptionDate)} />
              <DetailField label="Expiry" value={fmtDate(placement.expiryDate)} />
            </div>
          </FormSection>

          <FormSection title="Comment">
            <RichTextView html={placement.description} />
          </FormSection>
        </div>
      )}
    </SidePanel>
  );
}
