'use client';

import React from 'react';
import { DocumentPreviewModal } from '@/components/organisms/reinsurance/documents/DocumentPreviewModal';
import { Facultative, PlacementParticipantClosing } from '@/types/reinsurance';
import { buildDocumentFileName } from '@/lib/reinsurance/documentFileName';
import { useCurrentTenantUsers } from '@/hooks';
import { TenantUser } from '@/types/tenant';

interface PlacementClosingSnapshotModalProps {
  isOpen: boolean;
  placement: Facultative;
  closing: PlacementParticipantClosing | null;
  onClose: () => void;
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function displayUserName(user: Pick<TenantUser, 'firstName' | 'lastName' | 'email'>): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email || 'Unknown user';
}

function resolveUserName(users: unknown, userId: string | null | undefined): string {
  if (!userId) return 'Unknown user';
  const list = Array.isArray(users) ? (users as TenantUser[]) : [];
  const user = list.find((item) => item.id === userId);
  return user ? displayUserName(user) : 'Unknown user';
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtPct(value: unknown): string {
  const numeric = numberValue(value);
  if (numeric === null) return '—';
  return `${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })}%`;
}

function fmtMoney(value: unknown, currency?: string | null): string {
  const numeric = numberValue(value);
  if (numeric === null) return '—';
  return `${currency ?? ''} ${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return text(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-gray-500">
        {children}
      </p>
      <div className="border-t border-gray-300" />
    </div>
  );
}

function InfoRows({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <table className="w-full border-collapse text-base">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="w-2/5 py-1.5 pr-4 text-gray-500">{row.label}</td>
            <td className="py-1.5 pl-4 font-medium text-gray-900">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PlacementClosingSnapshotModal({
  isOpen,
  placement,
  closing,
  onClose,
}: PlacementClosingSnapshotModalProps) {
  const { data: tenantUsers = [] } = useCurrentTenantUsers({
    enabled: isOpen && Boolean(closing?.createdByUserId),
  });

  if (!closing) return null;

  const reinsurer = closing.participant.counterparty;
  const createdByName = resolveUserName(tenantUsers, closing.createdByUserId);

  return (
    <DocumentPreviewModal
      isOpen={isOpen}
      title={`Closing Snapshot — ${closing.closingNumber}`}
      documentTitle="Placement Closing Snapshot"
      fileName={buildDocumentFileName(
        'Placement Closing Snapshot',
        closing.closingNumber,
        placement.reference,
        reinsurer.name,
      )}
      qrValue={`${closing.closingNumber}:${closing.id}:${closing.status}`}
      onPrint={() => {}}
      onClose={onClose}
    >
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
        Backend closing snapshot. Values are read from the confirmed placement closing record.
      </div>

      <SectionHeading>Closing Control</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Closing Number', value: closing.closingNumber },
          { label: 'Status', value: closing.status },
          { label: 'Created', value: fmtDate(closing.createdAt) },
          { label: 'Issued At', value: fmtDate(closing.issuedAt) },
          { label: 'Confirmed At', value: fmtDate(closing.confirmedAt) },
          { label: 'Created By', value: createdByName },
        ]}
      />

      <SectionHeading>Placement</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Placement Reference', value: placement.reference },
          { label: 'Insured', value: placement.title },
          { label: 'Class of Business', value: text(placement.classOfBusiness) },
          { label: 'Cedant', value: placement.cedant.name },
          { label: 'Currency', value: text(closing.currency ?? placement.currency) },
        ]}
      />

      <SectionHeading>Reinsurer</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Reinsurer', value: reinsurer.name },
          { label: 'Registration Number', value: text(reinsurer.registrationNumber) },
          { label: 'Participant ID', value: closing.participantId },
        ]}
      />

      <SectionHeading>Financial Snapshot</SectionHeading>
      <InfoRows
        rows={[
          { label: 'Signed Line', value: fmtPct(closing.signedLinePercent) },
          { label: 'Share Percent', value: fmtPct(closing.sharePercent) },
          { label: 'Gross Premium', value: fmtMoney(closing.grossPremium, closing.currency) },
          { label: 'Commission Percent', value: fmtPct(closing.commissionPercent) },
          {
            label: 'Commission Amount',
            value: fmtMoney(closing.commissionAmount, closing.currency),
          },
          { label: 'Brokerage Percent', value: fmtPct(closing.brokeragePercent) },
          { label: 'Brokerage Amount', value: fmtMoney(closing.brokerageAmount, closing.currency) },
          { label: 'Net Premium', value: fmtMoney(closing.netPremium, closing.currency) },
        ]}
      />
    </DocumentPreviewModal>
  );
}
