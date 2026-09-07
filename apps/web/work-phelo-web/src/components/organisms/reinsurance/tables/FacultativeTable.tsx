'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateFacultativePanel } from '@/components/organisms/reinsurance/panels/CreateFacultativePanel';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import { PartialEditFacultativePanel } from '@/components/organisms/reinsurance/panels/PartialEditFacultativePanel';
import { RenewFacultativePanel } from '@/components/organisms/reinsurance/panels/RenewFacultativePanel';
import { EndorsementPanel } from '@/components/organisms/reinsurance/panels/EndorsementPanel';
import { Facultative, FacultativeStatus } from '@/types/reinsurance';
import {
  useDeleteFacultative,
  useFacultativesPage,
  useForceCloseFacultative,
  useRestoreFacultative,
  useCurrentTenantUsers,
  usePaymentsWorklist,
  useFacultativeRowState,
} from '@/hooks';
import { TenantUser } from '@/types/tenant';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  acceptedPercentFor,
  CedantPaymentStatus as PaymentStatus,
  facultativeStatusLabel,
  isEffectivelyClosed,
  RAW_STATUS_VARIANT_MAP,
} from '@/lib/reinsurance/placementStatus';
import { useToast } from '@/hooks/useToast';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 10;

const OPEN_PLACEMENT_STATUSES: FacultativeStatus[] = [
  'DRAFT',
  'MARKETING',
  'PARTIALLY_PLACED',
  'PLACED',
];

const CLOSED_PLACEMENT_STATUSES: FacultativeStatus[] = [
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

function displayUserName(user: Pick<TenantUser, 'firstName' | 'lastName' | 'email'>): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email || 'Unknown user';
}

function fmtAmount(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
const CLOSING_PAYMENT_FILTER_OPTIONS = [
  { value: 'Outstanding', label: 'Outstanding' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Part Payment', label: 'Part Payment' },
  { value: 'Paid', label: 'Paid' },
];

const PLACEMENTS_FILTER_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'MARKETING', label: 'On Market' },
  { value: 'PARTIALLY_PLACED', label: 'Partially Placed' },
  { value: 'PLACED', label: 'Placed' },
  ...CLOSING_PAYMENT_FILTER_OPTIONS,
];

const CLOSING_STATUS_FILTER_OPTIONS = [
  { value: 'CLOSING', label: 'Partially Closed' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const CLOSING_FILTER_OPTIONS = [
  // ...CLOSING_STATUS_FILTER_OPTIONS,
  ...CLOSING_PAYMENT_FILTER_OPTIONS,
];

const RAW_STATUS_OPTIONS = new Set<string>([
  'DRAFT',
  'MARKETING',
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
]);

function rawStatusFilter(value: string): FacultativeStatus | undefined {
  return RAW_STATUS_OPTIONS.has(value) ? (value as FacultativeStatus) : undefined;
}

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  Outstanding: 'text-[10px] text-gray-400',
  Pending: 'text-[10px] text-amber-600 font-medium',
  'Part Payment': 'text-[10px] text-yellow-600 font-medium',
  Paid: 'text-[10px] text-green-600 font-medium',
};

function PaymentStatusCell({
  placement,
  paymentStatus,
}: {
  placement: Facultative;
  paymentStatus: PaymentStatus;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Badge
        label={facultativeStatusLabel(placement.status)}
        variant={RAW_STATUS_VARIANT_MAP[placement.status]}
      />
      <span className={PAYMENT_STATUS_CLASS[paymentStatus]}>{paymentStatus}</span>
    </div>
  );
}

// Closing tab only: when the offer was created.
const OFFER_DATE_COLUMN: Column<Facultative> = {
  key: 'createdAt',
  label: 'Offer Date',
  width: '90px',
  render: (row) => (
    <span className="font-semibold text-gray-700">{fmtDateTime(row.createdAt)}</span>
  ),
};

const SUM_INSURED_COLUMN: Column<Facultative> = {
  key: 'sumInsured',
  label: '100% Sum Insured',
  width: '150px',
  className: 'text-right',
  render: (row) => (
    <span className="font-semibold text-gray-900">
      {row.sumInsured != null ? `${row.currency ?? ''} ${fmtAmount(row.sumInsured)}` : '—'}
    </span>
  ),
};

const COLUMNS: Column<Facultative>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '150px',
    render: (row) => (
      <EndorsedReferencePill id={row.id} reference={displayPolicyNumber(row.policyNumber)} />
    ),
  },
  {
    key: 'title',
    label: 'Insured / Risk Type',
    width: 'minmax(120px, 0.8fr)',
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
    width: 'minmax(120px, 0.8fr)',
    render: (row) => <span className="font-bold text-gray-700">{row.cedant.name}</span>,
  },

  SUM_INSURED_COLUMN,
  {
    key: 'premium',
    label: '100% Premium',
    width: '100px',
    className: 'text-right',
    render: (row) => (
      <span className="font-semibold text-gray-900">
        {row.premium != null ? `${row.currency ?? ''} ${fmtAmount(row.premium)}` : '—'}
      </span>
    ),
  },
  {
    key: 'facultativeOffer',
    label: 'Fac Offer',
    width: '70px',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900">
          {row.facultativeOffer != null ? `${row.facultativeOffer}%` : '—'}
        </span>
      </div>
    ),
  },

  {
    key: 'totalAcceptedPercent',
    label: 'Signing Progress',
    width: '150px',
    render: (row) => {
      const facOffer = row.facultativeOffer ?? 0;
      const closedPercent = acceptedPercentFor(row);
      const barWidth = facOffer > 0 ? Math.min(100, (closedPercent / facOffer) * 100) : 0;
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">{closedPercent.toFixed(1)}%</span>
            <span className="text-gray-400">{barWidth.toFixed(0)}% Closed</span>
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
    key: 'participants' as keyof Facultative,
    label: 'Participants',
    width: '90px',
    render: (row) => {
      const total = row.participants?.length ?? 0;
      const closed =
        row.participants?.filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED').length ??
        0;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-900">
            {closed} / {total}
          </span>
          <span className="text-xs text-gray-400">Accepted</span>
        </div>
      );
    },
  },
  {
    key: 'status',
    label: 'Status',
    width: '100px',
  },
];

// Closing tab: participants are frozen once closed, so the total is redundant noise —
// just show how many accepted.
const CLOSED_PARTICIPANTS_COLUMN: Column<Facultative> = {
  key: 'participants' as keyof Facultative,
  label: 'Participants',
  width: '90px',
  render: (row) => {
    const closed =
      row.participants?.filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED').length ?? 0;
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900">{closed}</span>
        <span className="text-xs text-gray-400">Accepted</span>
      </div>
    );
  },
};

export function FacultativeTable({
  tab = 'placements',
}: {
  tab?: 'placements' | 'closing' | 'archived';
}) {
  const toast = useToast();
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const canCreateOffer = useAnyPermissionRules(RiPerm.createOffer);
  const canEditOffer = useAnyPermissionRules(RiPerm.editOffer);
  const canPartialEdit = useAnyPermissionRules(RiPerm.partialEdit);
  const canReopenOffer = useAnyPermissionRules(RiPerm.reopenOffer);
  const canForceCloseOffer = useAnyPermissionRules(RiPerm.forceClose);
  const canEndorseOffer = useAnyPermissionRules(RiPerm.endorseOffer);
  const canArchiveOffer = useAnyPermissionRules(RiPerm.archiveOffer);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Facultative | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Facultative | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Facultative | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Facultative | null>(null);
  const [partialEditTarget, setPartialEditTarget] = useState<Facultative | null>(null);
  const [renewTarget, setRenewTarget] = useState<Facultative | null>(null);
  const [endorseTarget, setEndorseTarget] = useState<Facultative | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [forceCloseTarget, setForceCloseTarget] = useState<Facultative | null>(null);

  const serverStatusFilter = rawStatusFilter(statusFilter);
  const placementsPage = useFacultativesPage({
    page,
    limit: PAGE_SIZE,
    search,
    archived: tab === 'archived',
    status: serverStatusFilter,
    statuses:
      !serverStatusFilter && tab === 'placements'
        ? OPEN_PLACEMENT_STATUSES
        : !serverStatusFilter && tab === 'closing'
          ? CLOSED_PLACEMENT_STATUSES
          : undefined,
  });
  const { data: tenantUsers = [] } = useCurrentTenantUsers({ enabled: tab === 'archived' });
  const { mutate: archivePlacement, isPending: isArchiving } = useDeleteFacultative();
  const { mutate: restorePlacement, isPending: isRestoring } = useRestoreFacultative();
  const { mutate: forceClosePlacement, isPending: isForceClosing } = useForceCloseFacultative(
    forceCloseTarget?.id ?? '',
  );

  const allRows = useMemo(() => placementsPage.data?.items ?? [], [placementsPage.data?.items]);
  const isLoading = placementsPage.isLoading;

  const closingRows = useMemo(() => (tab === 'closing' ? allRows : []), [allRows, tab]);

  const closingPlacementIds = useMemo(() => closingRows.map((row) => row.id), [closingRows]);

  const closingPaymentsWorkList = usePaymentsWorklist(
    {
      page: 1,
      limit: PAGE_SIZE,
      placementIds: closingPlacementIds,
    },
    {
      enabled: tab === 'closing' && closingPlacementIds.length > 0,
    },
  );

  const paymentStatusMap = useMemo(() => {
    const map = new Map<string, PaymentStatus>();

    closingRows.forEach((row) => {
      map.set(row.id, 'Outstanding');
    });

    for (const row of closingPaymentsWorkList.data?.items ?? []) {
      map.set(row.placementId, row.paymentStatus);
    }
    return map;
  }, [closingRows, closingPaymentsWorkList.data?.items]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.policyNumber?.toLowerCase().includes(q) ?? false) ||
          r.cedant.name.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.classOfBusiness?.toLowerCase().includes(q) ?? false),
      );
    }
    if (statusFilter && tab !== 'archived') {
      if (tab === 'placements') {
        rows = rows.filter((r) => r.status === statusFilter);
      } else {
        const isStatusFilter = CLOSING_STATUS_FILTER_OPTIONS.some(
          (opt) => opt.value === statusFilter,
        );
        rows = isStatusFilter
          ? rows.filter((r) => r.status === statusFilter)
          : rows.filter((r) => paymentStatusMap.get(r.id) === (statusFilter as PaymentStatus));
      }
    }
    // Open tab filters by when the offer was created; Closing tab by when it was closed.
    const dateField: 'createdAt' | 'updatedAt' = tab === 'closing' ? 'updatedAt' : 'createdAt';
    if (dateFrom) {
      const from = new Date(dateFrom);
      rows = rows.filter((r) => new Date(r[dateField]) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      rows = rows.filter((r) => new Date(r[dateField]) <= to);
    }
    return rows;
  }, [allRows, search, statusFilter, dateFrom, dateTo, tab, paymentStatusMap]);

  // Closing tab: most recently closed first — CLOSED/CLOSING placements are effectively
  // frozen once they land there, so updatedAt reliably marks the close moment.
  const sorted = useMemo(() => {
    if (tab !== 'closing') return filtered;
    return [...filtered].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [filtered, tab]);

  const totalPages = Math.max(1, placementsPage.data?.meta.totalPages ?? 1);
  const paged = sorted;
  const visiblePlacementIds = useMemo(
    () => (tab === 'archived' ? [] : paged.map((row) => row.id)),
    [paged, tab],
  );

  const facultativeRowState = useFacultativeRowState(visiblePlacementIds, {
    enabled: tab !== 'archived' && visiblePlacementIds.length > 0,
  });

  const rowStateByPlacementId = useMemo(
    () => new Map((facultativeRowState.data?.items ?? []).map((item) => [item.placementId, item])),
    [facultativeRowState.data?.items],
  );

  const hasPaymentMap = useMemo(() => {
    const map = new Map<string, boolean>();

    if (tab !== 'placements') return map;

    for (const row of paged) {
      map.set(row.id, rowStateByPlacementId.get(row.id)?.hasRecordedPayment ?? false);
    }

    return map;
  }, [paged, rowStateByPlacementId, tab]);

  const openPaymentStatusMap = useMemo(() => {
    const map = new Map<string, PaymentStatus>();

    if (tab !== 'placements') return map;

    for (const row of paged) {
      map.set(row.id, rowStateByPlacementId.get(row.id)?.paymentStatus ?? 'Outstanding');
    }

    return map;
  }, [paged, rowStateByPlacementId, tab]);

  const hasEndorsementMap = useMemo(() => {
    const map = new Map<string, boolean>();

    if (tab === 'archived') return map;

    for (const row of paged) {
      map.set(row.id, rowStateByPlacementId.get(row.id)?.hasNonVoidEndorsement ?? false);
    }

    return map;
  }, [paged, rowStateByPlacementId, tab]);

  const endorsementCountMap = useMemo(() => {
    const map = new Map<string, number>();

    if (tab === 'archived') return map;

    for (const row of paged) {
      map.set(row.id, rowStateByPlacementId.get(row.id)?.nonVoidEndorsementCount ?? 0);
    }

    return map;
  }, [paged, rowStateByPlacementId, tab]);

  // Placements tab: only the current page needs a paid/unpaid check, just to swap
  // Edit Offer for Partial Edit once a payment exists — no filtering depends on this.

  // Reopen Offer is only valid once no endorsement has been made on the placement —
  // reopening after an endorsement would let the original offer diverge from what's
  // since been endorsed. Excludes VOID endorsements, same as EndorsedReferencePill.

  const columns = useMemo<Column<Facultative>[]>(() => {
    const userNameById = new Map(
      (Array.isArray(tenantUsers) ? (tenantUsers as TenantUser[]) : []).map((user) => [
        user.id,
        displayUserName(user),
      ]),
    );
    const actorName = (userId: string | null) =>
      userId ? (userNameById.get(userId) ?? 'Unknown user') : 'Unknown user';

    // Endorsements amend the policy without touching the base placement record, so the raw
    // row.sumInsured / row.premium / row.facultativeOffer never move. Overlay the effective
    // terms from row-state (which the backend already falls back to base values for) so the
    // table matches the placement detail page once an endorsement has passed.
    const effectiveTermsFor = (placementId: string) =>
      tab === 'archived' ? undefined : rowStateByPlacementId.get(placementId);

    const columnsWithRowState = COLUMNS.map((col) => {
      if (tab === 'archived') return col;

      if (col.key === 'reference') {
        return {
          ...col,
          render: (row: Facultative) => (
            <EndorsedReferencePill
              id={row.id}
              reference={displayPolicyNumber(row.policyNumber)}
              endorsementCount={endorsementCountMap.get(row.id) ?? 0}
            />
          ),
        };
      }

      if (col.key === 'sumInsured') {
        return {
          ...col,
          render: (row: Facultative) => {
            const value = effectiveTermsFor(row.id)?.effectiveSumInsured ?? row.sumInsured;
            return (
              <span className="font-semibold text-gray-900">
                {value != null ? `${row.currency ?? ''} ${fmtAmount(value)}` : '—'}
              </span>
            );
          },
        };
      }

      if (col.key === 'premium') {
        return {
          ...col,
          render: (row: Facultative) => {
            const value = effectiveTermsFor(row.id)?.effectivePremium ?? row.premium;
            return (
              <span className="font-semibold text-gray-900">
                {value != null ? `${row.currency ?? ''} ${fmtAmount(value)}` : '—'}
              </span>
            );
          },
        };
      }

      if (col.key === 'facultativeOffer') {
        return {
          ...col,
          render: (row: Facultative) => {
            const value =
              effectiveTermsFor(row.id)?.effectiveFacultativeOfferPercent ?? row.facultativeOffer;
            return (
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-gray-900">
                  {value != null ? `${value}%` : '—'}
                </span>
              </div>
            );
          },
        };
      }

      return col;
    });

    if (tab === 'closing') {
      // Signing Progress is dropped for closed placements; 100% Sum Insured (from COLUMNS) stays.
      return columnsWithRowState
        .filter((col) => col.key !== 'totalAcceptedPercent')
        .flatMap((col) => {
          if (col.key === 'participants') return [CLOSED_PARTICIPANTS_COLUMN];

          if (col.key === 'status') {
            return [
              OFFER_DATE_COLUMN,
              {
                ...col,
                render: (row: Facultative) => (
                  <PaymentStatusCell
                    placement={row}
                    paymentStatus={paymentStatusMap.get(row.id) ?? 'Outstanding'}
                  />
                ),
              },
            ];
          }

          return [col];
        });
    }

    if (tab === 'placements') {
      return columnsWithRowState.filter((col) => col.key !== 'status');
    }

    if (tab !== 'archived') return COLUMNS;

    const ARCHIVED_HIDDEN_KEYS = new Set([
      'sumInsured',
      'totalAcceptedPercent',
      'participants',
      'status',
    ]);

    return [
      ...COLUMNS.filter((col) => !ARCHIVED_HIDDEN_KEYS.has(col.key as string)),
      {
        key: 'archivedAt',
        label: 'Archive Details',
        width: 'minmax(200px, 1.5fr)',
        render: (row) => (
          <div className="flex flex-col gap-1">
            <Badge label="Archived" variant="neutral" />
            <span className="text-xs text-gray-500">{fmtDateTime(row.archivedAt)}</span>
            {row.archivedByUserId && (
              <span className="text-xs text-gray-400" title={row.archivedByUserId}>
                Archived by: {actorName(row.archivedByUserId)}
              </span>
            )}
            {row.archiveReason && (
              <span className="text-xs text-gray-500 line-clamp-2">{row.archiveReason}</span>
            )}
          </div>
        ),
      },
      {
        key: 'restore' as keyof Facultative,
        label: '',
        width: '90px',
        render: (row) => (
          <TableButton variant="green" onClick={() => setRestoreTarget(row)}>
            Restore
          </TableButton>
        ),
      },
    ];
  }, [tab, tenantUsers, paymentStatusMap, endorsementCountMap, rowStateByPlacementId]);

  const closeArchiveModal = () => {
    setArchiveTarget(null);
    setArchiveReason('');
  };

  const handleArchive = () => {
    if (!archiveTarget) return;
    archivePlacement(
      {
        id: archiveTarget.id,
        archiveReason: archiveReason.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Placement archived successfully');
          closeArchiveModal();
        },
        onError: (err) => toast.error(extractError(err, 'Failed to archive placement')),
      },
    );
  };

  const handleRestore = () => {
    if (!restoreTarget) return;
    restorePlacement(restoreTarget.id, {
      onSuccess: () => {
        toast.success('Placement restored successfully');
        setRestoreTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to restore placement')),
    });
  };

  const handleForceClose = () => {
    if (!forceCloseTarget) return;
    forceClosePlacement(undefined, {
      onSuccess: () => {
        toast.success('Placement force closed successfully');
        setForceCloseTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to force close placement')),
    });
  };

  const getRowActions = (row: Facultative): RowAction[] => {
    if (tab === 'archived') {
      return [];
    }

    const detailUrl = `/${tenantSlug}/operations/reinsurance/facultative/${row.id}${
      tab === 'closing' ? '?from=closing' : ''
    }`;

    // Renewing only makes sense once an offer has left the draft/open stages; endorsing only
    // applies to an offer that has actually closed (a policy is in force to amend).
    const rowIsClosed = isEffectivelyClosed(row);
    const renewAction: RowAction | null =
      rowIsClosed && canCreateOffer
        ? { label: 'Renew Offer', onClick: () => setRenewTarget(row), variant: 'success' }
        : null;
    const endorseAction: RowAction | null =
      row.status === 'CLOSED' && canEndorseOffer
        ? { label: 'Endorse Policy', onClick: () => setEndorseTarget(row) }
        : null;

    if (tab === 'closing' && row.status !== 'DECLINED' && row.status !== 'CANCELLED') {
      const paymentStatus = paymentStatusMap.get(row.id) ?? 'Outstanding';
      const partialEditAction: RowAction | null = canPartialEdit
        ? { label: 'Partial Edit', onClick: () => setPartialEditTarget(row) }
        : null;

      // Anything other than a clean 'Outstanding' (Pending, Part Payment, or Paid) means money
      // has moved or is in flight — Reopen/Archive only make sense while nothing has happened yet.
      if (paymentStatus !== 'Outstanding') {
        return [
          { label: 'View Offer', onClick: () => router.push(detailUrl) },
          ...(partialEditAction ? [partialEditAction] : []),
          ...(endorseAction ? [endorseAction] : []),
          ...(renewAction ? [renewAction] : []),
        ];
      }

      const hasEndorsement = hasEndorsementMap.get(row.id) ?? false;

      return [
        { label: 'View Offer Details', onClick: () => router.push(detailUrl) },
        ...(hasEndorsement || !canReopenOffer
          ? []
          : [{ label: 'Reopen Offer', onClick: () => setReopenTarget(row) }]),
        ...(partialEditAction ? [partialEditAction] : []),
        ...(canArchiveOffer
          ? [{ label: 'Archive', onClick: () => setArchiveTarget(row), danger: true }]
          : []),
        ...(endorseAction ? [endorseAction] : []),
        ...(renewAction ? [renewAction] : []),
      ];
    }

    if (tab === 'placements') {
      const paymentStatus = openPaymentStatusMap.get(row.id) ?? 'Outstanding';
      const canArchive = paymentStatus === 'Outstanding';
      const isPartiallyClosed = row.status === 'PARTIALLY_PLACED' || row.status === 'CLOSING';
      const hasEndorsement = hasEndorsementMap.get(row.id) ?? false;
      const forceCloseAction: RowAction | null =
        row.status === 'CLOSING' && canForceCloseOffer
          ? { label: 'Force Close', onClick: () => setForceCloseTarget(row), danger: true }
          : null;
      const archiveAction: RowAction | null =
        canArchive && canArchiveOffer
          ? { label: 'Archive', onClick: () => setArchiveTarget(row), danger: true }
          : null;
      const reopenAction: RowAction | null =
        isPartiallyClosed && !hasEndorsement && canReopenOffer
          ? { label: 'Reopen Offer', onClick: () => setReopenTarget(row) }
          : null;
      const wantsPartialEdit = isPartiallyClosed || !!hasPaymentMap.get(row.id);
      const editAction: RowAction | null = wantsPartialEdit
        ? canPartialEdit
          ? { label: 'Partial Edit', onClick: () => setPartialEditTarget(row) }
          : null
        : canEditOffer
          ? { label: 'Edit Offer', onClick: () => setEditTarget(row) }
          : null;

      // Rows in this tab are, by definition, not yet effectively closed (draft/open statuses),
      // so neither Renew nor Endorse Policy applies here.
      return [
        { label: 'View Offer', onClick: () => router.push(detailUrl) },
        ...(reopenAction ? [reopenAction] : []),
        ...(editAction ? [editAction] : []),
        ...(forceCloseAction ? [forceCloseAction] : []),
        ...(archiveAction ? [archiveAction] : []),
      ];
    }

    const fallbackPaymentStatus = paymentStatusMap.get(row.id) ?? 'Outstanding';
    const canArchiveFallback = fallbackPaymentStatus === 'Outstanding';

    return [
      { label: 'View', onClick: () => router.push(detailUrl) },
      ...(canEditOffer ? [{ label: 'Edit Slip', onClick: () => setEditTarget(row) }] : []),
      ...(canArchiveFallback && canArchiveOffer
        ? [{ label: 'Archive', onClick: () => setArchiveTarget(row), danger: true }]
        : []),
      ...(endorseAction ? [endorseAction] : []),
      ...(renewAction ? [renewAction] : []),
    ];
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search facultative…"
        searchValue={search}
        onRowClick={
          tab === 'archived'
            ? undefined
            : (row) =>
                router.push(
                  `/${tenantSlug}/operations/reinsurance/facultative/${row.id}${tab === 'closing' ? '?from=closing' : ''}`,
                )
        }
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={
          (tab === 'placements' || tab === 'closing') && (
            <div className="flex items-center gap-2">
              <SearchSelect
                size="sm"
                placeholder="Status"
                options={tab === 'placements' ? PLACEMENTS_FILTER_OPTIONS : CLOSING_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              />
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder={tab === 'closing' ? 'Closed from' : 'Created from'}
                  value={dateFrom}
                  onChange={(v) => {
                    setDateFrom(v);
                    setPage(1);
                  }}
                />
              </div>
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder={tab === 'closing' ? 'Closed to' : 'Created to'}
                  value={dateTo}
                  minDate={dateFrom || undefined}
                  onChange={(v) => {
                    setDateTo(v);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          )
        }
        actionButton={
          tab === 'placements' && canCreateOffer
            ? { label: 'New Offer', onClick: () => setPanelOpen(true) }
            : undefined
        }
        rowActions={getRowActions}
        emptyMessage={
          tab === 'archived'
            ? 'No archived facultative placements found'
            : 'No facultative placements found'
        }
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <CreateFacultativePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      {editTarget && (
        <EditFacultativePanel
          isOpen={!!editTarget}
          placement={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}

      {reopenTarget && (
        <EditFacultativePanel
          isOpen={!!reopenTarget}
          placement={reopenTarget}
          onClose={() => setReopenTarget(null)}
          mode="reopen"
        />
      )}

      {partialEditTarget && (
        <PartialEditFacultativePanel
          isOpen={!!partialEditTarget}
          placement={partialEditTarget}
          onClose={() => setPartialEditTarget(null)}
        />
      )}

      {renewTarget && (
        <RenewFacultativePanel
          isOpen={!!renewTarget}
          placement={renewTarget}
          onClose={() => setRenewTarget(null)}
        />
      )}

      {endorseTarget && (
        <EndorsementPanel
          isOpen={!!endorseTarget}
          placement={endorseTarget}
          onClose={() => setEndorseTarget(null)}
          onCreated={() =>
            router.push(
              `/${tenantSlug}/operations/reinsurance/facultative/${endorseTarget.id}?tab=endorsement`,
            )
          }
        />
      )}

      <Modal
        isOpen={!!archiveTarget}
        onClose={closeArchiveModal}
        title="Archive Placement?"
        description="This placement will be removed from the active list. It can be restored later."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeArchiveModal} disabled={isArchiving}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isArchiving}
              loadingText="Archiving…"
              onClick={handleArchive}
            >
              Archive
            </Button>
          </div>
        }
      >
        <label className="mt-4 block text-sm font-medium text-gray-700">
          Reason <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={archiveReason}
          onChange={(event) => setArchiveReason(event.target.value)}
          maxLength={500}
          rows={3}
          className="mt-2 w-full rounded-input border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-(--focus-ring,var(--color-gray-400))"
          placeholder="Why is this placement being archived?"
        />
      </Modal>

      <Modal
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        title="Restore Placement?"
        description={`Restore "${displayPolicyNumber(restoreTarget?.policyNumber)}" to the active facultative list?`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRestoreTarget(null)} disabled={isRestoring}>
              Cancel
            </Button>
            <Button isLoading={isRestoring} loadingText="Restoring…" onClick={handleRestore}>
              Restore
            </Button>
          </div>
        }
      />

      <Modal
        isOpen={!!forceCloseTarget}
        onClose={() => setForceCloseTarget(null)}
        title="Force Close Placement?"
        description={`This bypasses the normal close workflow and closes "${displayPolicyNumber(forceCloseTarget?.policyNumber)}" at its actual placed capacity. Outstanding workflow history is preserved, but the offer will no longer accept changes.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setForceCloseTarget(null)}
              disabled={isForceClosing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isForceClosing}
              loadingText="Force closing…"
              onClick={handleForceClose}
            >
              Force Close
            </Button>
          </div>
        }
      />
    </>
  );
}
