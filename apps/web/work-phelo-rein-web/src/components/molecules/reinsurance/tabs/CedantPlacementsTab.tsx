'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { FilterChip } from '@/components/atoms/FilterChip';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import {
  CedantPlacementFilter,
  CedantPlacementRow,
  Facultative,
  FacultativeStatus,
  toStatusLabel,
} from '@/types/reinsurance';
import { useCedantPlacementsWorklist } from '@/hooks/reinsurance/useFacultatives';
import { useFacultativePlacementRowActions } from '@/hooks/reinsurance/useFacultativePlacementRowActions';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

const PAGE_SIZE = 10;

const STATUS_VARIANT_MAP: Record<FacultativeStatus, 'success' | 'warning' | 'danger' | 'neutral'> =
  {
    DRAFT: 'neutral',
    MARKETING: 'warning',
    PARTIALLY_PLACED: 'success',
    PLACED: 'success',
    CLOSING: 'success',
    CLOSED: 'success',
    DECLINED: 'danger',
    CANCELLED: 'danger',
  };

type PaymentStatus = 'Outstanding' | 'Pending' | 'Part Payment' | 'Paid';

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  Outstanding: 'text-xs text-gray-400',
  Pending: 'text-xs text-blue-600 font-medium',
  'Part Payment': 'text-xs text-yellow-600 font-medium',
  Paid: 'text-xs text-green-600 font-medium',
};

function fmtAmount(val: number | null, currency: string | null): string {
  if (val == null) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function PaymentStatusCell({ placement }: { placement: CedantPlacementRow }) {
  const paymentStatus = placement.paymentStatus;
  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge
        label={toStatusLabel(placement.status)}
        variant={STATUS_VARIANT_MAP[placement.status]}
      />
      <span className={PAYMENT_STATUS_CLASS[paymentStatus]}>{paymentStatus}</span>
    </div>
  );
}

const PLACEMENT_COLUMNS: Column<CedantPlacementRow>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '190px',
    render: (row) => (
      <EndorsedReferencePill id={row.id} reference={displayPolicyNumber(row.policyNumber)} />
    ),
  },
  {
    key: 'title',
    label: 'Insured / Risk Type',
    width: '1.6fr',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900 leading-tight">{row.title}</span>
        <span className="text-xs text-gray-400">{row.classOfBusiness ?? '—'}</span>
      </div>
    ),
  },
  {
    key: 'facultativeOffer',
    label: 'Fac. Offer',
    width: '100px',
    render: (row) => (
      <span className="font-semibold text-gray-900">
        {row.facultativeOffer != null ? `${row.facultativeOffer}%` : '—'}
      </span>
    ),
  },
  {
    key: 'premium',
    label: 'Fac. Premium',
    width: '1.2fr',
    render: (row) => (
      <span className="font-semibold text-gray-900 whitespace-nowrap">
        {fmtAmount(row.premium, row.currency)}
      </span>
    ),
  },
  {
    key: 'commission',
    label: 'Net Premium',
    width: '1.2fr',
    render: (row) => {
      const net =
        row.premium != null && row.facultativeOffer != null && row.commission != null
          ? (row.facultativeOffer / 100) * row.premium * (1 - row.commission / 100)
          : null;
      return (
        <span className="font-medium text-gray-700 whitespace-nowrap">
          {fmtAmount(net, row.currency)}
        </span>
      );
    },
  },
  {
    key: 'totalAcceptedPercent',
    label: 'Signing Progress',
    width: '160px',
    className: 'pr-6',
    render: (row) => {
      const facOffer = row.facultativeOffer ?? 0;
      const accepted = row.totalAcceptedPercent ?? 0;
      const barWidth = facOffer > 0 ? Math.min(100, (accepted / facOffer) * 100) : 0;
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">{accepted.toFixed(1)}%</span>
            <span className="text-gray-400">{barWidth.toFixed(0)}% Placed</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barWidth >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
      );
    },
  },
  {
    key: 'participants',
    label: 'Participants',
    width: '110px',
    render: (row) => {
      const total = row.participants?.length ?? 0;
      const accepted =
        row.participants?.filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED').length ??
        0;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-900">
            {accepted} / {total}
          </span>
          <span className="text-xs text-gray-400">accepted</span>
        </div>
      );
    },
  },
  {
    key: 'status',
    label: 'Status',
    width: '120px',
    render: (row) => <PaymentStatusCell placement={row} />,
  },
  {
    key: 'inceptionDate',
    label: 'Period',
    width: '200px',
    render: (row) => (
      <span className="text-gray-500 whitespace-nowrap">
        {fmtDate(row.inceptionDate)} – {fmtDate(row.expiryDate)}
      </span>
    ),
  },
];

type PlacementFilter = CedantPlacementFilter;

interface CedantPlacementsTabProps {
  cedantId: string;
  onView: (placement: Facultative) => void;
  onPremiums: (placement: Facultative) => void;
  onDisbursement: (placement: Facultative) => void;
}

export function CedantPlacementsTab({
  cedantId,
  onView,
  onPremiums,
  onDisbursement,
}: CedantPlacementsTabProps) {
  const [filter, _setFilter] = useState<PlacementFilter>('all');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCedantPlacementsWorklist({
    cedantId,
    filter,
    page,
    limit: PAGE_SIZE,
  });
  const placements = data?.items ?? [];

  const canAddPayment = useAnyPermissionRules(RiPerm.addPayment);

  const { getRowActions, dialogs } = useFacultativePlacementRowActions({
    placements,
    onView,
    preloadedRowState: placements.map((placement) => ({
      placementId: placement.id,
      paymentStatus: placement.paymentStatus,
      hasRecordedPayment: placement.hasRecordedPayment,
      nonVoidEndorsementCount: placement.hasNonVoidEndorsement ? 1 : 0,
      hasNonVoidEndorsement: placement.hasNonVoidEndorsement,
      effectiveSumInsured: placement.sumInsured,
      effectivePremium: placement.premium,
      effectiveFacultativeOfferPercent: placement.facultativeOffer,
      effectiveParticipantCount: placement.acceptedParticipantCount,
    })),
    extraActions: (row) => {
      // Premium receipt / disbursement only make sense once the policy is in force.
      if (row.status !== 'CLOSED' || !canAddPayment) return [];
      const payStatus =
        placements.find((placement) => placement.id === row.id)?.paymentStatus ?? 'Outstanding';
      return [
        ...(payStatus !== 'Paid'
          ? [{ label: 'Premium Payment', onClick: () => onPremiums(row) }]
          : []),
        ...(payStatus !== 'Outstanding'
          ? [{ label: 'Disbursement', onClick: () => onDisbursement(row) }]
          : []),
      ];
    },
  });

  const counts = useMemo(
    () => data?.summary ?? { all: 0, pending: 0, closed: 0, unpaid: 0, paid: 0 },
    [data?.summary],
  );

  function setFilter(f: PlacementFilter) {
    _setFilter(f);
    setPage(1);
  }

  const totalPages = Math.max(1, data?.meta.totalPages ?? 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip
          label="All Offers"
          count={counts.all}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterChip
          label="Pending"
          count={counts.pending}
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
        />
        <FilterChip
          label="Closed"
          count={counts.closed}
          active={filter === 'closed'}
          onClick={() => setFilter('closed')}
        />
        <FilterChip
          label="Unpaid Offers"
          count={counts.unpaid}
          active={filter === 'unpaid'}
          onClick={() => setFilter('unpaid')}
        />
        <FilterChip
          label="Paid Offers"
          count={counts.paid}
          active={filter === 'paid'}
          onClick={() => setFilter('paid')}
        />
      </div>

      <DataTable
        columns={PLACEMENT_COLUMNS}
        data={placements}
        isLoading={isLoading}
        emptyMessage="No placements found"
        rowActions={getRowActions}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      {dialogs}
    </div>
  );
}
