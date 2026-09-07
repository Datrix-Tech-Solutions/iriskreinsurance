'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { FilterChip } from '@/components/atoms/FilterChip';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Facultative, FacultativeStatus, toStatusLabel } from '@/types/reinsurance';
import {
  confirmedNetPremiumFor,
  totalEffectivePremiumReceived,
  useCedantPlacementPaymentStatuses,
  usePlacementClosings,
  usePlacementPayments,
} from '@/hooks';
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

type PaymentStatus = 'Outstanding' | 'Part Payment' | 'Paid';

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  Outstanding: 'text-xs text-gray-400',
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

function PaymentStatusCell({ placement }: { placement: Facultative }) {
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const { data: closings = [] } = usePlacementClosings(placement.id);
  const netPremium = confirmedNetPremiumFor(closings);
  const paid = totalEffectivePremiumReceived(payments);

  let paymentStatus: PaymentStatus = 'Outstanding';
  if (netPremium > 0 && paid >= netPremium) paymentStatus = 'Paid';
  else if (paid > 0) paymentStatus = 'Part Payment';

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

const PLACEMENT_COLUMNS: Column<Facultative>[] = [
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

type PlacementFilter = 'all' | 'pending' | 'closed' | 'unpaid' | 'paid';

interface CedantPlacementsTabProps {
  placements: Facultative[];
  isLoading: boolean;
  onView: (placement: Facultative) => void;
  onPremiums: (placement: Facultative) => void;
  onDisbursement: (placement: Facultative) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function CedantPlacementsTab({
  placements,
  isLoading,
  onView,
  onPremiums,
  onDisbursement,
  currentPage,
  totalPages: serverTotalPages,
  onPageChange,
}: CedantPlacementsTabProps) {
  const [filter, _setFilter] = useState<PlacementFilter>('all');
  const [localPage, setLocalPage] = useState(1);
  const page = currentPage ?? localPage;
  const setPage = onPageChange ?? setLocalPage;

  const paymentStatuses = useCedantPlacementPaymentStatuses(placements);
  const canAddPayment = useAnyPermissionRules(RiPerm.addPayment);

  const { getRowActions, dialogs } = useFacultativePlacementRowActions({
    placements,
    onView,
    extraActions: (row) => {
      // Premium receipt / disbursement only make sense once the policy is in force.
      if (row.status !== 'CLOSED' || !canAddPayment) return [];
      const payStatus = paymentStatuses.get(row.id) ?? 'outstanding';
      return [
        ...(payStatus !== 'paid'
          ? [{ label: 'Premium Payment', onClick: () => onPremiums(row) }]
          : []),
        ...(payStatus !== 'outstanding'
          ? [{ label: 'Disbursement', onClick: () => onDisbursement(row) }]
          : []),
      ];
    },
  });

  const counts = useMemo(
    () => ({
      all: placements.length,
      pending: placements.filter((p) => p.status === 'DRAFT' || p.status === 'MARKETING').length,
      closed: placements.filter(
        (p) =>
          p.status === 'PARTIALLY_PLACED' ||
          p.status === 'PLACED' ||
          p.status === 'CLOSING' ||
          p.status === 'CLOSED',
      ).length,
      unpaid: placements.filter((p) => {
        const s = paymentStatuses.get(p.id);
        return s === 'outstanding' || s === 'partial';
      }).length,
      paid: placements.filter((p) => paymentStatuses.get(p.id) === 'paid').length,
    }),
    [placements, paymentStatuses],
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case 'pending':
        return placements.filter((p) => p.status === 'DRAFT' || p.status === 'MARKETING');
      case 'closed':
        return placements.filter(
          (p) =>
            p.status === 'PARTIALLY_PLACED' ||
            p.status === 'PLACED' ||
            p.status === 'CLOSING' ||
            p.status === 'CLOSED',
        );
      case 'unpaid':
        return placements.filter((p) => {
          const s = paymentStatuses.get(p.id);
          return s === 'outstanding' || s === 'partial';
        });
      case 'paid':
        return placements.filter((p) => paymentStatuses.get(p.id) === 'paid');
      default:
        return placements;
    }
  }, [placements, filter, paymentStatuses]);

  function setFilter(f: PlacementFilter) {
    _setFilter(f);
    setPage(1);
  }

  const totalPages = serverTotalPages ?? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = serverTotalPages
    ? filtered
    : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        data={paged}
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
