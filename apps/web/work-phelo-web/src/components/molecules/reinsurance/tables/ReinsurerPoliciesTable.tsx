'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { FacultativeStatus, TreatyType, toStatusLabel } from '@/types/reinsurance';

export type OfferType = 'Facultative' | TreatyType;

export interface ReinsurerParticipation {
  id: string;
  reference: string;
  title: string;
  cedant: string;
  role: string;
  sharePercent: string | null;
  participantStatus: string;
  placementStatus: FacultativeStatus;
  offerType: OfferType;
  inceptionDate: string | null;
  expiryDate: string | null;
}

interface ReinsurerPoliciesTableProps {
  data: ReinsurerParticipation[];
  isLoading?: boolean;
  onRowClick?: (id: string) => void;
}

const PAGE_SIZE = 10;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

const PLACEMENT_VARIANT_MAP: Record<
  FacultativeStatus,
  'success' | 'warning' | 'neutral' | 'danger'
> = {
  DRAFT: 'neutral',
  MARKETING: 'warning',
  PARTIALLY_PLACED: 'success',
  PLACED: 'success',
  CLOSING: 'success',
  CLOSED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'danger',
};

function formatRole(role: string): string {
  switch (role) {
    case 'LEAD_REINSURER':
      return 'Lead';
    case 'CO_REINSURER':
      return 'Co-Reinsurer';
    case 'REINSURER':
      return 'Reinsurer';
    case 'BROKER':
      return 'Broker';
    default:
      return role;
  }
}

const COLUMNS: Column<ReinsurerParticipation>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '190px',
    render: (row) => <EndorsedReferencePill id={row.id} reference={row.reference} />,
  },
  {
    key: 'title',
    label: 'Insured / Cedant',
    width: '1.8fr',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900 leading-tight">{row.title}</span>
        <span className="text-xs text-gray-400">{row.cedant}</span>
      </div>
    ),
  },
  {
    key: 'role',
    label: 'Role',
    width: '120px',
    render: (row) => <span className="text-gray-600">{formatRole(row.role)}</span>,
  },
  {
    key: 'offerType',
    label: 'Offer Type',
    width: '150px',
    render: (row) => <span className="text-gray-700 text-sm">{row.offerType}</span>,
  },
  {
    key: 'sharePercent',
    label: 'Share (%)',
    width: '100px',
    render: (row) => (
      <span className="font-semibold text-gray-900">
        {row.sharePercent != null ? `${row.sharePercent}%` : '—'}
      </span>
    ),
  },
  {
    key: 'placementStatus',
    label: 'Status',
    width: '140px',
    render: (row) => (
      <div className="flex flex-col gap-1 items-start">
        <Badge
          label={toStatusLabel(row.placementStatus)}
          variant={PLACEMENT_VARIANT_MAP[row.placementStatus]}
        />
        <span className="text-xs text-gray-400">{statusLabel(row.participantStatus)}</span>
      </div>
    ),
  },
  {
    key: 'period',
    label: 'Period',
    width: '1.2fr',
    render: (row) => (
      <span className="text-gray-500 whitespace-nowrap">
        {formatDate(row.inceptionDate)} – {formatDate(row.expiryDate)}
      </span>
    ),
  },
];

export function ReinsurerPoliciesTable({
  data,
  isLoading,
  onRowClick,
}: ReinsurerPoliciesTableProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DataTable
      columns={COLUMNS}
      data={paged}
      isLoading={isLoading}
      emptyMessage="No offers found for this reinsurer"
      onRowClick={onRowClick ? (row) => onRowClick(row.id) : undefined}
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
