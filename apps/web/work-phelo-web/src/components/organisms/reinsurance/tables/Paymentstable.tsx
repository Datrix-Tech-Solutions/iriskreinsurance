'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  FacultativeStatus,
  PaymentWorklistRow,
  PaymentWorklistStatusFilter,
  toStatusLabel,
} from '@/types/reinsurance';
import { useCedants, usePaymentsWorklist, usePlacementPayments } from '@/hooks';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { cn } from '@/lib/utils';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';
import { ViewOfferPanel } from '@/components/organisms/reinsurance/panels/ViewOfferPanel';

const PAGE_SIZE = 10;

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null | undefined) {
  if (val == null) return '—';
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const RAW_STATUS_VARIANT_MAP: Record<
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

function paymentStatusLabel(status: FacultativeStatus): string {
  if (status === 'CLOSING' || status === 'CLOSED') return 'Closed';
  return toStatusLabel(status);
}

const PAYMENT_STATUS_CLASS: Record<PaymentWorklistRow['paymentStatus'], string> = {
  Outstanding: 'text-xs text-gray-400',
  Pending: 'text-xs text-amber-600 font-medium',
  'Part Payment': 'text-xs text-yellow-600 font-medium',
  Paid: 'text-xs text-green-600 font-medium',
};

// const STATUS_FILTER_OPTIONS = [
//   { value: 'Placed', label: 'Placed' },
//   { value: 'Closed', label: 'Closed' },
//   { value: 'Pending', label: 'Pending' },
//   { value: 'Part Payment', label: 'Part Payment' },
//   { value: 'Paid', label: 'Paid' },
// ];

function PaymentSummaryCell({ row }: { row: PaymentWorklistRow }) {
  const cur = row.currency ?? '';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-bold text-gray-900">
        {cur} {fmtAmount(row.paidAmount)}
      </span>
      <span className="text-xs text-gray-400">
        {cur} {fmtAmount(Math.abs(row.outstandingAmount))} {row.outstandingLabel}
      </span>
    </div>
  );
}

// const PAYMENT_RECORD_STATUS_LABEL: Record<string, string> = {
//   RECORDED: 'Recorded',
//   BANK_CONFIRMED: 'Bank Confirmed',
//   FAILED: 'Failed',
//   CANCELLED: 'Cancelled',
//   REVERSED: 'Reversed',
// };

function PaymentStatusCell({ row }: { row: PaymentWorklistRow }) {
  const [hovered, setHovered] = useState(false);
  const { data: payments = [], isLoading } = usePlacementPayments(row.placementId, {
    enabled: hovered,
  });

  const history = payments
    .filter((p) => p.type === 'PREMIUM_RECEIVED' && !p.reversalOfPaymentId)
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge
        label={paymentStatusLabel(row.placementStatus)}
        variant={RAW_STATUS_VARIANT_MAP[row.placementStatus]}
      />
      <span
        className={cn(PAYMENT_STATUS_CLASS[row.paymentStatus], 'relative cursor-default')}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {row.paymentStatus}

        {hovered && !isLoading && history.length > 0 && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none">
            <span className="block bg-(--chip-dark,#111827) text-white rounded-lg shadow-xl px-2.5 py-1.5 text-[10px] whitespace-nowrap">
              <span className="block font-semibold text-[11px] mb-1">Payment History</span>
              <span className="flex flex-col gap-0.5">
                {history.map((p) => (
                  <span key={p.id} className="flex justify-between gap-4">
                    <span className="text-[#9ca3af]">{fmtDate(p.paymentDate)}</span>
                    <span className="font-medium">
                      {p.currency} {fmtAmount(parseFloat(p.amount))}
                    </span>
                    {/* <span className="text-[#9ca3af]">
                      {PAYMENT_RECORD_STATUS_LABEL[p.status] ?? p.status}
                    </span> */}
                  </span>
                ))}
              </span>
            </span>
            <span className="block w-2 h-2 bg-(--chip-dark,#111827) rotate-45 rounded-sm mx-auto -mt-1" />
          </span>
        )}
      </span>
    </div>
  );
}

const COLUMNS: Column<PaymentWorklistRow>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '150px',
    render: (row) => (
      <EndorsedReferencePill
        id={row.placementId}
        reference={displayPolicyNumber(row.policyNumber)}
      />
    ),
  },
  {
    key: 'title',
    label: 'Insured / Risk Type',
    width: 'minmax(120px, 1fr)',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900 leading-tight">{row.title}</span>
        <span className="text-xs text-gray-400">{row.classOfBusiness ?? '—'}</span>
      </div>
    ),
  },
  {
    key: 'cedant',
    label: 'Cedant',
    width: 'minmax(100px, 1fr)',
    render: (row) => <span className="font-bold text-gray-700">{row.cedantName}</span>,
  },
  {
    key: 'sumInsured',
    label: '100% Sum Insured',
    width: '130px',
    className: 'text-right',
    render: (row) => {
      const value = row.effectiveSumInsured ?? row.sumInsured;
      return (
        <span className="font-semibold text-gray-900 whitespace-nowrap">
          {value != null ? `${row.currency ?? ''} ${fmtAmount(value)}` : '—'}
        </span>
      );
    },
  },
  {
    key: 'premium',
    label: '100% Premium',
    width: '130px',
    className: 'text-right',
    render: (row) => (
      <span className="font-semibold text-gray-900 whitespace-nowrap">
        {row.effectivePremium != null
          ? `${row.currency ?? ''} ${fmtAmount(row.effectivePremium)}`
          : '—'}
      </span>
    ),
  },
  {
    key: 'facultativeOffer',
    label: 'Your Share',
    width: '130px',
    className: 'text-right',
    render: (row) => {
      const share = row.effectiveFacultativeSumInsured ?? row.facultativeSumInsured;
      const offer = row.effectiveFacultativeOfferPercent ?? row.facultativeOffer;
      return (
        <div className="flex flex-col gap-0.5 items-end">
          <span className="font-semibold text-gray-900 whitespace-nowrap">
            {share != null ? `${row.currency ?? ''} ${fmtAmount(share)}` : '—'}
          </span>
          <span className="text-xs text-gray-400">{offer != null ? `${offer}% share` : '—'}</span>
        </div>
      );
    },
  },
  // {
  //   key: 'participants',
  //   label: 'Participants',
  //   width: '90px',
  //   render: (row) => (
  //     <div className="flex flex-col gap-0.5">
  //       <span className="font-semibold text-gray-900">{row.acceptedParticipantCount}</span>
  //       <span className="text-xs text-gray-400">accepted</span>
  //     </div>
  //   ),
  // },
  {
    key: 'commission',
    label: 'Commission',
    width: '70px',
    render: (row) => (
      <span className="font-bold text-gray-700">
        {row.commission != null ? `${row.commission}%` : '—'}
      </span>
    ),
  },
  {
    key: 'collectedToDate',
    label: 'Net Premium',
    width: '150px',
    render: (row) => <PaymentSummaryCell row={row} />,
  },

  {
    key: 'createdAt',
    label: 'Offer Date',
    width: '90px',
    render: (row) => <span className="font-semibold text-gray-700">{fmtDate(row.createdAt)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '100px',
    className: 'pr-6',
    render: (row) => <PaymentStatusCell row={row} />,
  },
];

export function PaymentsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter] = useState<PaymentWorklistStatusFilter | ''>('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [addPaymentPlacementId, setAddPaymentPlacementId] = useState<string | undefined>(undefined);
  const [viewOfferRow, setViewOfferRow] = useState<PaymentWorklistRow | null>(null);

  const canAddPayment = useAnyPermissionRules(RiPerm.addPayment);

  const openAddPayment = (row?: PaymentWorklistRow) => {
    setAddPaymentPlacementId(row?.id);
    setIsAddPaymentOpen(true);
  };

  const {
    data: worklist,
    isLoading,
    isError,
  } = usePaymentsWorklist({
    page,
    limit: PAGE_SIZE,
    search,
    status: statusFilter,
    cedantId: cedantFilter,
  });
  const { data: cedants = [] } = useCedants();

  const cedantOptions = useMemo(() => {
    return cedants
      .map((cedant) => ({ value: cedant.id, label: cedant.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cedants]);

  const paged = worklist?.items ?? [];
  const totalPages = Math.max(1, worklist?.meta.totalPages ?? 1);

  const getRowActions = (row: PaymentWorklistRow): RowAction[] => {
    const viewOffer: RowAction = {
      label: 'View Offer',
      onClick: () => setViewOfferRow(row),
    };
    const disbursePayment: RowAction = {
      label: 'Disburse Payment',
      onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`),
    };

    switch (row.paymentStatus) {
      case 'Outstanding':
        return [
          viewOffer,
          ...(canAddPayment ? [{ label: 'Add Payment', onClick: () => openAddPayment(row) }] : []),
        ];
      case 'Paid':
        return [viewOffer, ...(canAddPayment ? [disbursePayment] : [])];
      case 'Part Payment':
        return [
          viewOffer,
          ...(canAddPayment
            ? [{ label: 'Make Payment', onClick: () => openAddPayment(row) }, disbursePayment]
            : []),
        ];
      default:
        return [viewOffer];
    }
  };

  const extraFilters = (
    <>
      <div className="w-78">
        <SearchSelect
          size="sm"
          placeholder="Cedants"
          options={cedantOptions}
          value={cedantFilter}
          onChange={(v) => {
            setCedantFilter(v);
            setPage(1);
          }}
        />
      </div>
      {/* <div className="w-40">
        <SearchSelect
          size="sm"
          placeholder="Status"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v as PaymentWorklistStatusFilter | '');
            setPage(1);
          }}
        />
      </div> */}
    </>
  );

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search payments…"
        searchValue={search}
        onRowClick={(row) =>
          router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`)
        }
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={extraFilters}
        searchAfterFilters
        // actionButton={{
        //   label: 'Receive Cedant Premium',
        //   onClick: () => openAddPayment(),
        // }}
        rowActions={getRowActions}
        singleActionAsButton={false}
        emptyMessage={isError ? 'Unable to load payment records' : 'No payment records found'}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddPaymentForm
        isOpen={isAddPaymentOpen}
        onClose={() => {
          setIsAddPaymentOpen(false);
          setAddPaymentPlacementId(undefined);
        }}
        placementId={addPaymentPlacementId}
        defaultCedantId={cedantFilter || undefined}
      />

      <ViewOfferPanel
        isOpen={!!viewOfferRow}
        row={viewOfferRow}
        onClose={() => setViewOfferRow(null)}
      />
    </>
  );
}
