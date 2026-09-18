'use client';

import React from 'react';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Counterparty, Facultative, PlacementEndorsement } from '@/types/reinsurance';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { useRiskTypes } from '@/hooks';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fmtVal(val: unknown): string {
  if (val == null || val === '') return '—';
  return String(val);
}

function fmtAmount(val: number | null | undefined, currency: string | null) {
  if (val == null) return '—';
  return `${currency ?? ''} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function getSnapshotPlacement(snapshot: Record<string, unknown>): Record<string, unknown> {
  if (snapshot.placement && typeof snapshot.placement === 'object') {
    return snapshot.placement as Record<string, unknown>;
  }
  return snapshot;
}

function toNum(val: unknown): number {
  if (val == null) return 0;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(n) ? 0 : n;
}

type FieldType = 'amount' | 'percent' | 'date' | 'text';

const CHANGE_FIELDS: { key: string; label: string; type: FieldType }[] = [
  { key: 'title', label: 'Insured', type: 'text' },
  { key: 'sumInsured', label: 'Sum Insured', type: 'amount' },
  { key: 'premium', label: 'Premium', type: 'amount' },
  { key: 'rate', label: 'Rate (%)', type: 'percent' },
  { key: 'facultativeOffer', label: 'Fac Offer %', type: 'percent' },
  { key: 'commission', label: 'Commission (%)', type: 'percent' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'inceptionDate', label: 'Inception Date', type: 'date' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
  { key: 'classOfBusiness', label: 'Class of Business', type: 'text' },
];

function renderFieldVal(val: unknown, type: FieldType, currency: string | null): string {
  if (val == null || val === '') return '—';
  if (type === 'amount') return fmtAmount(toNum(val), currency);
  if (type === 'percent') return `${toNum(val)}%`;
  if (type === 'date') return fmtDate(String(val));
  return String(val);
}

function buildChangeSentence(
  changedFields: { key: string; label: string; type: FieldType }[],
  originalPlacement: Record<string, unknown>,
  proposed: Record<string, unknown>,
  effectiveDate: string,
  prevCurrency: string | null,
  currency: string | null,
): React.ReactNode {
  if (changedFields.length === 0) return null;

  const clauses: React.ReactNode[] = changedFields.map(({ key, label, type }) => {
    const prev = originalPlacement[key];
    const curr = proposed[key];
    const prevStr = renderFieldVal(prev, type, prevCurrency);
    const currStr = renderFieldVal(curr, type, currency);
    let verb = 'changed';
    if (type === 'amount' || type === 'percent') {
      verb = toNum(curr) > toNum(prev) ? 'increased' : 'decreased';
    }
    return (
      <React.Fragment key={key}>
        the {label.toLowerCase()} was {verb} from <strong>{prevStr}</strong> to{' '}
        <strong>{currStr}</strong>
      </React.Fragment>
    );
  });

  const joined: React.ReactNode[] = [];
  clauses.forEach((clause, i) => {
    if (i > 0) {
      joined.push(
        <React.Fragment key={`sep-${i}`}>
          {i === clauses.length - 1 ? ', and ' : ', '}
        </React.Fragment>,
      );
    }
    joined.push(clause);
  });

  return (
    <>
      Effective from <strong>{fmtDate(effectiveDate)}</strong>, {joined}.
    </>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <p className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-1">
        {children}
      </p>
      <div className="border-t border-gray-300" />
    </div>
  );
}

interface EndorsementCertificateModalProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement: PlacementEndorsement;
  cedant?: Counterparty;
  onPrint: () => void;
  onClose: () => void;
}

export function EndorsementCertificateModal({
  isOpen,
  placement,
  endorsement,
  cedant,
  onPrint,
  onClose,
}: EndorsementCertificateModalProps) {
  const { data: riskTypes = [] } = useRiskTypes();
  const riskTypeName = riskTypes.find((rt) => rt.id === placement.riskTypeId)?.name ?? null;

  const originalPlacement = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  const primaryAddress = cedant?.addresses?.find((a) => a.isPrimary) ?? cedant?.addresses?.[0];

  const prevCurrency = String(originalPlacement.currency ?? '');
  const currency = placement.currency;

  const changedFields = proposed
    ? CHANGE_FIELDS.filter(({ key }) => {
        const prev = originalPlacement[key];
        const curr = proposed[key];
        return curr !== undefined && String(prev ?? '') !== String(curr ?? '');
      })
    : [];

  const narrative =
    proposed && changedFields.length > 0
      ? buildChangeSentence(
          changedFields,
          originalPlacement,
          proposed,
          endorsement.effectiveDate,
          prevCurrency,
          currency,
        )
      : null;

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Endorsement Certificate — ${endorsement.endorsementNumber}`}
      documentTitle="Endorsement Certificate"
      fileName={buildDocumentFileName(
        'Endorsement Certificate',
        displayPolicyNumber(placement.policyNumber),
        riskTypeName,
        placement.title,
        `to ${placement.cedant.name}`,
      )}
      onPrint={onPrint}
      onClose={onClose}
    >
      <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide pt-1 pb-2 text-center">
        Endorsement Certificate
      </p>

      {/* Letter header */}
      <div className="flex flex-col gap-0.5 text-base mb-6">
        <p className="text-gray-400 mb-3">{fmtDate(new Date().toISOString())}</p>
        <p className="font-semibold text-gray-900">The Managing Director</p>
        <p className="text-gray-800">{placement.cedant.name}</p>
        {primaryAddress && (
          <>
            <p className="text-gray-600">{primaryAddress.line1}</p>
            {primaryAddress.line2 && <p className="text-gray-600">{primaryAddress.line2}</p>}
            <p className="text-gray-600">{primaryAddress.city}</p>
          </>
        )}
      </div>

      {/* POLICY INFORMATION */}
      <SectionHeading>Policy Information</SectionHeading>
      <table className="w-full text-base border-collapse mb-2">
        <tbody>
          {[
            { label: 'Cedant', value: placement.cedant.name },
            { label: 'Insured', value: fmtVal(placement.title) },
            { label: 'Policy Number', value: displayPolicyNumber(placement.policyNumber) },
            { label: 'Endorsement No.', value: endorsement.endorsementNumber },
            { label: 'Effective Date', value: fmtDate(endorsement.effectiveDate) },
            { label: 'Currency', value: fmtVal(placement.currency) },
            { label: 'Class of Business', value: fmtVal(placement.classOfBusiness) },
          ].map((row) => (
            <tr key={row.label}>
              <td className="py-1.5 pr-4 text-gray-500 w-2/5">{row.label}</td>
              <td className="py-1.5 pl-4 text-gray-900 font-medium">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ENDORSEMENT SUMMARY */}
      <SectionHeading>Endorsement Summary</SectionHeading>
      <div className="text-base mb-2 space-y-2">
        {narrative ? (
          <p className="text-gray-800 leading-relaxed">{narrative}</p>
        ) : (
          <p className="text-gray-400 italic">No parameter changes recorded.</p>
        )}
        {endorsement.reason && (
          <div>
            <span className="text-gray-500">Comment:</span>
            <p className="text-gray-900 font-medium mt-0.5">{endorsement.reason}</p>
          </div>
        )}
      </div>

      {/* SPECIAL CONDITIONS */}
      <SectionHeading>Special Conditions</SectionHeading>
      <ul className="text-sm text-gray-700 space-y-1 list-none mb-2">
        <li>• All other terms remain unchanged.</li>
        <li>• This endorsement forms part of the original facultative slip.</li>
      </ul>
    </DocumentPreviewModal>
  );
}
