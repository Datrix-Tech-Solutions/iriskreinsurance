'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Button } from '@/components/atoms/Button';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  ClaimTabRow,
  useDeletePlacementClaim,
  useUpdatePlacementClaimUnbound,
  useClaimsWorklist,
  useCedants,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { extractError } from '@/lib/extractError';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { cn } from '@/lib/utils';
import { TypeChip, TypeChipColor } from '@/components/atoms/TypeChip';
import {
  ClaimTag,
  CLAIM_TAG_OPTIONS,
  claimTagToState,
} from '@/components/molecules/reinsurance/forms/MakeClaimFormFields';
import { ClaimState } from '@/types/reinsurance';

// "Claim state" (Pending / Finalized) is orthogonal to the claim lifecycle status.
// FINALIZED is when reinsurer allocations exist and the financial inputs are locked.
const CLAIM_STATE_META: Record<ClaimState, { label: string; color: TypeChipColor }> = {
  PENDING: { label: 'Pending', color: 'amber' },
  FINALIZED: { label: 'Finalized', color: 'green' },
};

const CLAIM_STATE_FILTER_OPTIONS = (Object.keys(CLAIM_STATE_META) as ClaimState[]).map((value) => ({
  value,
  label: CLAIM_STATE_META[value].label,
}));

/** Effective state for display: trust the persisted enum, but treat legacy rows that
 *  predate it (no claimState, final loss set) as Finalized. */
const effectiveClaimState = (claim: {
  claimState?: ClaimState | null;
  finalLossAmount: string | null;
}): ClaimState => claim.claimState ?? (claim.finalLossAmount != null ? 'FINALIZED' : 'PENDING');

const PAGE_SIZE = 10;

export type ClaimsTableTab = 'notification' | 'open' | 'closed';

function fmtAmount(val: number | string | null | undefined, currency?: string | null) {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: string | null | undefined) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildColumns(tab: ClaimsTableTab): Column<ClaimTabRow>[] {
  const policyNumber: Column<ClaimTabRow> = {
    key: 'reference',
    label: 'Policy Number',
    width: '130px',
    render: (row) => (
      <EndorsedReferencePill
        id={row.placement.id}
        reference={displayPolicyNumber(row.placement.policyNumber)}
        endorsementCount={row.nonVoidEndorsementCount}
      />
    ),
  };

  const insuredRiskType: Column<ClaimTabRow> = {
    key: 'title',
    label: 'Insured / Risk Type',
    width: 'minmax(150px, 0.8fr)',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900 leading-tight">{row.placement.title}</span>
        <span className="text-xs text-gray-400">{row.placement.classOfBusiness ?? '—'}</span>
      </div>
    ),
  };

  const claimNumber: Column<ClaimTabRow> = {
    key: 'claimNumber',
    label: 'Claim Number',
    width: '110px',
    render: (row) => <span className="font-medium text-gray-900">{row.claim.claimNumber}</span>,
  };

  const cedant: Column<ClaimTabRow> = {
    key: 'cedant',
    label: 'Cedant',
    width: 'minmax(100px, 0.8fr)',
    render: (row) => <span className="font-bold text-gray-700">{row.placement.cedant.name}</span>,
  };

  const offerPercent: Column<ClaimTabRow> = {
    key: 'offerPercent',
    label: 'Offer %',
    width: '55px',
    className: 'text-right',
    render: (row) => (
      <span className="font-bold text-gray-900 whitespace-nowrap">
        {row.placement.facultativeOffer != null
          ? `${row.placement.facultativeOffer.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
          : '—'}
      </span>
    ),
  };

  const actualClaim: Column<ClaimTabRow> = {
    key: 'finalLossAmount',
    label: '100% Claim Amount',
    width: '140px',
    className: 'text-right',
    render: (row) => (
      <span className="font-bold text-gray-900 whitespace-nowrap">
        {fmtAmount(row.claim.finalLossAmount, row.claim.currency)}
      </span>
    ),
  };

  const claimShare: Column<ClaimTabRow> = {
    key: 'claimShare',
    label: 'iRisk Share',
    width: '120px',
    className: 'text-right',
    render: (row) => (
      <span className="font-semibold text-gray-900 whitespace-nowrap">
        {fmtAmount(row.claimShare, row.claim.currency)}
      </span>
    ),
  };

  const totalRecovered: Column<ClaimTabRow> = {
    key: 'recoveredAmount',
    label: 'Total Recovered',
    width: '120px',
    className: 'text-right',
    render: (row) => (
      <span
        className={cn(
          'font-bold whitespace-nowrap',
          row.recoveredAmount && row.recoveredAmount > 0 ? 'text-emerald-600' : 'text-gray-400',
        )}
      >
        {fmtAmount(row.recoveredAmount, row.claim.currency)}
      </span>
    ),
  };

  const claimState: Column<ClaimTabRow> = {
    key: 'claimState',
    label: 'Claim State',
    width: '80px',
    render: (row) => {
      const meta = CLAIM_STATE_META[effectiveClaimState(row.claim)];
      return <TypeChip label={meta.label} color={meta.color} />;
    },
  };

  const claimEntryDate: Column<ClaimTabRow> = {
    key: 'createdAt',
    label: 'Claim entry date',
    width: '120px',
    render: (row) => (
      <span className="font-semibold text-gray-600">{fmtDate(row.claim.createdAt)}</span>
    ),
  };
  const dateOfLoss: Column<ClaimTabRow> = {
    key: 'dateOfLoss',
    label: 'Date of Loss',
    width: '100px',
    render: (row) => (
      <span className="font-semibold text-gray-600">{fmtDate(row.claim.occurrenceDate)}</span>
    ),
  };

  if (tab === 'open') {
    return [
      policyNumber,
      insuredRiskType,
      claimNumber,
      cedant,
      claimState,
      actualClaim,
      offerPercent,
      claimShare,
      totalRecovered,
      dateOfLoss,
      claimEntryDate,
    ];
  }

  if (tab === 'closed') {
    return [
      policyNumber,
      insuredRiskType,
      claimNumber,
      cedant,
      actualClaim,
      offerPercent,
      claimShare,
      dateOfLoss,
      {
        key: 'recoveredAt',
        label: 'Recovered Date',
        width: '120px',
        render: (row) => (
          <span className="font-semibold text-gray-600">{fmtDate(row.recoveredAt)}</span>
        ),
      },
    ];
  }

  // notification
  return [
    policyNumber,
    insuredRiskType,
    claimNumber,
    cedant,
    {
      key: 'estimatedLossAmount',
      label: '100% Estimated Claim',
      width: '150px',
      className: 'text-right',
      render: (row) => (
        <span className="font-medium text-gray-900 whitespace-nowrap">
          {fmtAmount(row.claim.estimatedLossAmount, row.claim.currency)}
        </span>
      ),
    },
    offerPercent,
    {
      // Reinsurer's share of the estimated claim = 100% estimate × fac offer %. Matches the
      // Total Allocated Claim figure once the claim is finalized and allocations are generated.
      key: 'notificationPayable',
      label: 'iRisk Share',
      width: '120px',
      className: 'text-right',
      render: (row) => (
        <span className="font-semibold text-gray-900 whitespace-nowrap">
          {fmtAmount(row.claimShare, row.claim.currency)}
        </span>
      ),
    },
    claimEntryDate,
  ];
}

interface ClaimsTableProps {
  tab?: ClaimsTableTab;
}

export function ClaimsTable({ tab = 'notification' }: ClaimsTableProps) {
  const router = useRouter();
  const toast = useToast();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const canViewClaim = useAnyPermissionRules(RiPerm.viewClaim);
  const canAddClaim = useAnyPermissionRules(RiPerm.addClaim);
  const canAddNotification = useAnyPermissionRules(RiPerm.addNotification);
  const canEditClaim = useAnyPermissionRules(RiPerm.editClaim);
  const canChangeClaimStatus = useAnyPermissionRules(RiPerm.claimStatusChange);
  const [search, setSearch] = useState('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [claimStateFilter, setClaimStateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelTarget, setPanelTarget] = useState<ClaimTabRow | null>(null);
  const [isAddClaimOpen, setIsAddClaimOpen] = useState(false);
  const [isAddNotificationOpen, setIsAddNotificationOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClaimTabRow | null>(null);
  const { mutate: deleteClaim, isPending: isDeleting } = useDeletePlacementClaim();

  const [successModal, setSuccessModal] = useState<{ title: string; message: string } | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<ClaimTabRow | null>(null);
  const [finalAmount, setFinalAmount] = useState('');
  const [finalAmountError, setFinalAmountError] = useState('');
  const [finalClaimTag, setFinalClaimTag] = useState<ClaimTag>('pending');
  const updateClaim = useUpdatePlacementClaimUnbound();
  const { data: cedants = [], isLoading: isLoadingCedants } = useCedants();

  const claimsWorklist = useClaimsWorklist({
    tab,
    page,
    limit: PAGE_SIZE,
    search,
    cedantId: cedantFilter || undefined,
    claimState: tab === 'open' && claimStateFilter ? (claimStateFilter as ClaimState) : undefined,
  });
  const claimRows = claimsWorklist.data?.items ?? [];

  const cedantOptions = useMemo(() => {
    return cedants
      .map((cedant) => ({ value: cedant.id, label: cedant.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cedants]);

  const totalPages = Math.max(1, claimsWorklist.data?.meta.totalPages ?? 1);
  const columns = useMemo(() => buildColumns(tab), [tab]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteClaim(
      { placementId: deleteTarget.placement.id, claimId: deleteTarget.claim.id },
      {
        onSuccess: () => {
          toast.success('Claim deleted successfully');
          setDeleteTarget(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to delete claim')),
      },
    );
  };

  const handleCloseFinalize = () => {
    setFinalizeTarget(null);
    setFinalAmount('');
    setFinalAmountError('');
    setFinalClaimTag('pending');
  };

  const handleFinalize = async () => {
    if (!finalizeTarget) return;
    const parsed = parseFloat(finalAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setFinalAmountError('100% Claim amount is required');
      return;
    }

    const claimState = claimTagToState(finalClaimTag);
    try {
      // FINALIZED here makes the back-end generate reinsurer allocations in the
      // same request; PENDING just records the actual amount.
      await updateClaim.mutateAsync({
        placementId: finalizeTarget.placement.id,
        claimId: finalizeTarget.claim.id,
        finalLossAmount: parsed,
        claimState,
      });

      setSuccessModal(
        claimState === 'FINALIZED'
          ? {
              title: 'Claim Finalized',
              message: 'Reinsurer allocations have been finalized for this claim.',
            }
          : {
              title: 'Claim Moved to Open',
              message: 'The 100% Claim amount has been recorded.',
            },
      );
      handleCloseFinalize();
    } catch (error) {
      toast.error(extractError(error, 'Failed to finalize claim'));
    }
  };

  const handleReverseToPending = async (row: ClaimTabRow) => {
    try {
      await updateClaim.mutateAsync({
        placementId: row.placement.id,
        claimId: row.claim.id,
        claimState: 'PENDING',
      });
      setSuccessModal({
        title: 'Claim Moved to Pending',
        message: 'The finanlized allocations have been voided.',
      });
    } catch (error) {
      toast.error(extractError(error, 'Failed to return claim to pending'));
    }
  };

  const handleMoveToFinalized = async (row: ClaimTabRow) => {
    try {
      await updateClaim.mutateAsync({
        placementId: row.placement.id,
        claimId: row.claim.id,
        claimState: 'FINALIZED',
      });
      setSuccessModal({
        title: 'Claim Finalized',
        message: 'Reinsurer allocations have been generated for this claim.',
      });
    } catch (error) {
      toast.error(extractError(error, 'Failed to finalize claim'));
    }
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={claimRows}
        isLoading={claimsWorklist.isLoading || isLoadingCedants}
        searchPlaceholder="Search claims…"
        searchValue={search}
        onRowClick={
          canViewClaim
            ? (row) =>
                router.push(
                  `/${tenantSlug}/operations/reinsurance/claims/${row.claim.id}?placementId=${row.placement.id}&tab=${tab}`,
                )
            : undefined
        }
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={
          <div className="flex gap-2">
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
            {tab === 'open' && (
              <SearchSelect
                size="sm"
                placeholder="Claim state"
                options={CLAIM_STATE_FILTER_OPTIONS}
                value={claimStateFilter}
                onChange={(v) => {
                  setClaimStateFilter(v);
                  setPage(1);
                }}
              />
            )}
          </div>
        }
        actionButton={
          canAddClaim && tab === 'open'
            ? { label: 'Add Claim', onClick: () => setIsAddClaimOpen(true) }
            : canAddNotification && tab === 'notification'
              ? { label: 'Add Notification', onClick: () => setIsAddNotificationOpen(true) }
              : undefined
        }
        rowActions={
          tab === 'closed'
            ? undefined
            : (row) => {
                const actions: RowAction[] = [];
                if (canViewClaim) {
                  actions.push({
                    label: 'View',
                    onClick: () =>
                      router.push(
                        `/${tenantSlug}/operations/reinsurance/claims/${row.claim.id}?placementId=${row.placement.id}&tab=${tab}`,
                      ),
                  });
                }
                if (canEditClaim) {
                  actions.push({ label: 'Edit Claim', onClick: () => setPanelTarget(row) });
                }
                if (tab === 'open') {
                  if (canEditClaim) {
                    const state = effectiveClaimState(row.claim);
                    if (state === 'FINALIZED') {
                      actions.push({
                        label: 'Move to Pending',
                        onClick: () => handleReverseToPending(row),
                      });
                    } else {
                      actions.push({
                        label: 'Move to Finalized',
                        onClick: () => handleMoveToFinalized(row),
                      });
                    }
                  }
                  return actions;
                }

                if (canEditClaim) {
                  actions.push({
                    label: 'Move to Open',
                    onClick: () => {
                      setFinalizeTarget(row);
                      setFinalAmount(row.claim.estimatedLossAmount);
                      setFinalAmountError('');
                    },
                  });
                }
                if (canChangeClaimStatus) {
                  actions.push({
                    label: 'Delete',
                    onClick: () => setDeleteTarget(row),
                    danger: true,
                  });
                }
                return actions;
              }
        }
        emptyMessage="No claims found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <MakeClaimPanel
        isOpen={!!panelTarget}
        placement={panelTarget?.placement}
        claim={panelTarget?.claim}
        onClose={() => setPanelTarget(null)}
      />

      {tab === 'open' && (
        <MakeClaimPanel
          isOpen={isAddClaimOpen}
          mode="actual"
          onClose={() => setIsAddClaimOpen(false)}
        />
      )}

      {tab === 'notification' && (
        <MakeClaimPanel
          isOpen={isAddNotificationOpen}
          mode="notification"
          onClose={() => setIsAddNotificationOpen(false)}
        />
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Claim"
        description={`Are you sure you want to delete claim "${deleteTarget?.claim.claimNumber}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting…"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        }
      />

      <Modal
        isOpen={!!finalizeTarget}
        onClose={handleCloseFinalize}
        title="Finalize Claim"
        description={`Enter the 100% claim amount for claim "${finalizeTarget?.claim.claimNumber}". This moves it out of Notification.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCloseFinalize}
              disabled={updateClaim.isPending}
            >
              Cancel
            </Button>
            <Button
              isLoading={updateClaim.isPending}
              loadingText="Finalizing…"
              onClick={handleFinalize}
            >
              Finalize Claim
            </Button>
          </div>
        }
      >
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            The claim amount was{' '}
            <span className="font-medium text-gray-900">
              {fmtAmount(finalizeTarget?.claim.estimatedLossAmount, finalizeTarget?.claim.currency)}
            </span>{' '}
            for the loss that occurred on the{' '}
            <span className="font-medium text-gray-900">
              {fmtDate(finalizeTarget?.claim.occurrenceDate)}
            </span>
            .
          </p>
          <NumberField
            label="100 % Claim Amount"
            value={finalAmount ? Number(finalAmount) : 0}
            onChange={(n) => {
              setFinalAmount(String(n));
              setFinalAmountError('');
            }}
            error={finalAmountError}
            placeholder="0.00"
          />
          <SearchSelect
            label="Claim state"
            placeholder="Select tag…"
            options={CLAIM_TAG_OPTIONS}
            value={finalClaimTag}
            onChange={(v) => setFinalClaimTag(v as ClaimTag)}
          />
        </div>
      </Modal>

      <SuccessModal
        isOpen={!!successModal}
        onClose={() => setSuccessModal(null)}
        title={successModal?.title ?? ''}
        message={successModal?.message}
      />
    </>
  );
}
