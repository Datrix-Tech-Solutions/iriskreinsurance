'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { RowAction } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import { PartialEditFacultativePanel } from '@/components/organisms/reinsurance/panels/PartialEditFacultativePanel';
import { RenewFacultativePanel } from '@/components/organisms/reinsurance/panels/RenewFacultativePanel';
import { EndorsementPanel } from '@/components/organisms/reinsurance/panels/EndorsementPanel';
import {
  useDeleteFacultative,
  useForceCloseFacultative,
  useFacultativeRowState,
} from '@/hooks/reinsurance/useFacultatives';
import { isEffectivelyClosed } from '@/lib/reinsurance/placementStatus';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { extractError } from '@/lib/extractError';
import { useToast } from '@/hooks/useToast';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { Facultative } from '@/types/reinsurance';

interface UseFacultativePlacementRowActionsOptions {
  /** The rows the menu will be built for — used to pre-fetch per-row payment / endorsement state. */
  placements: Facultative[];
  /** How the "View" action behaves. FacultativeTable navigates to the detail route; callers
   *  with an in-page placement view (e.g. the cedant detail page) pass their own handler. */
  onView: (placement: Facultative) => void;
  /** Actions appended after the status-driven ones — e.g. Premium Payment / Disbursement. */
  extraActions?: (placement: Facultative) => RowAction[];
  /** Called after an endorsement is created. Defaults to navigating to the placement's
   *  facultative endorsement tab, matching FacultativeTable. */
  onEndorsementCreated?: (placement: Facultative) => void;
}

/**
 * The status-driven facultative placement row menu (View / Edit / Partial Edit / Reopen /
 * Force Close / Archive / Endorse Policy / Renew Offer) plus the panels and modals those
 * actions open, extracted so it can be reused wherever a list of placements is shown.
 * Mirrors the branch logic in `FacultativeTable.getRowActions`.
 */
export function useFacultativePlacementRowActions({
  placements,
  onView,
  extraActions,
  onEndorsementCreated,
}: UseFacultativePlacementRowActionsOptions): {
  getRowActions: (placement: Facultative) => RowAction[];
  dialogs: React.ReactNode;
} {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const toast = useToast();

  const canEditOffer = useAnyPermissionRules(RiPerm.editOffer);
  const canPartialEdit = useAnyPermissionRules(RiPerm.partialEdit);
  const canReopenOffer = useAnyPermissionRules(RiPerm.reopenOffer);
  const canForceCloseOffer = useAnyPermissionRules(RiPerm.forceClose);
  const canEndorseOffer = useAnyPermissionRules(RiPerm.endorseOffer);
  const canArchiveOffer = useAnyPermissionRules(RiPerm.archiveOffer);
  const canCreateOffer = useAnyPermissionRules(RiPerm.createOffer);

  const [editTarget, setEditTarget] = useState<Facultative | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Facultative | null>(null);
  const [partialEditTarget, setPartialEditTarget] = useState<Facultative | null>(null);
  const [renewTarget, setRenewTarget] = useState<Facultative | null>(null);
  const [endorseTarget, setEndorseTarget] = useState<Facultative | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Facultative | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [forceCloseTarget, setForceCloseTarget] = useState<Facultative | null>(null);

  const { mutate: archivePlacement, isPending: isArchiving } = useDeleteFacultative();
  const { mutate: forceClosePlacement, isPending: isForceClosing } = useForceCloseFacultative(
    forceCloseTarget?.id ?? '',
  );

  const placementIds = useMemo(() => placements.map((p) => p.id), [placements]);
  const rowState = useFacultativeRowState(placementIds, { enabled: placementIds.length > 0 });
  const rowStateById = useMemo(
    () => new Map((rowState.data?.items ?? []).map((item) => [item.placementId, item])),
    [rowState.data?.items],
  );

  const closeArchiveModal = () => {
    setArchiveTarget(null);
    setArchiveReason('');
  };

  const handleArchive = () => {
    if (!archiveTarget) return;
    archivePlacement(
      { id: archiveTarget.id, archiveReason: archiveReason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Placement archived successfully');
          closeArchiveModal();
        },
        onError: (err) => toast.error(extractError(err, 'Failed to archive placement')),
      },
    );
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
    const rs = rowStateById.get(row.id);
    const paymentStatus = rs?.paymentStatus ?? 'Outstanding';
    const hasRecordedPayment = rs?.hasRecordedPayment ?? false;
    const hasEndorsement = rs?.hasNonVoidEndorsement ?? false;

    const rowIsClosed = isEffectivelyClosed(row);
    const canArchive = paymentStatus === 'Outstanding';
    const archiveAction: RowAction = {
      label: 'Archive',
      onClick: () => setArchiveTarget(row),
      danger: true,
    };
    const renewAction: RowAction | null =
      rowIsClosed && canCreateOffer
        ? { label: 'Renew Offer', onClick: () => setRenewTarget(row), variant: 'success' }
        : null;
    const endorseAction: RowAction | null =
      row.status === 'CLOSED' && canEndorseOffer
        ? { label: 'Endorse Policy', onClick: () => setEndorseTarget(row) }
        : null;
    const extras = extraActions?.(row) ?? [];

    // Declined / cancelled offers: nothing is in force, so only the slip-level actions apply.
    if (row.status === 'DECLINED' || row.status === 'CANCELLED') {
      return [
        { label: 'View', onClick: () => onView(row) },
        ...(canEditOffer ? [{ label: 'Edit Slip', onClick: () => setEditTarget(row) }] : []),
        ...(canArchive && canArchiveOffer ? [archiveAction] : []),
        ...(renewAction ? [renewAction] : []),
        ...extras,
      ];
    }

    // Effectively closed (a policy is in force): amend via endorsement / partial edit, and
    // reopen only while no money has moved and nothing has been endorsed.
    if (rowIsClosed) {
      const partialEditAction: RowAction | null = canPartialEdit
        ? { label: 'Partial Edit', onClick: () => setPartialEditTarget(row) }
        : null;

      if (paymentStatus !== 'Outstanding') {
        return [
          { label: 'View Offer', onClick: () => onView(row) },
          ...(partialEditAction ? [partialEditAction] : []),
          ...(endorseAction ? [endorseAction] : []),
          ...(renewAction ? [renewAction] : []),
          ...extras,
        ];
      }

      return [
        { label: 'View Offer Details', onClick: () => onView(row) },
        ...(hasEndorsement || !canReopenOffer
          ? []
          : [{ label: 'Reopen Offer', onClick: () => setReopenTarget(row) }]),
        ...(partialEditAction ? [partialEditAction] : []),
        ...(canArchiveOffer ? [archiveAction] : []),
        ...(endorseAction ? [endorseAction] : []),
        ...(renewAction ? [renewAction] : []),
        ...extras,
      ];
    }

    // Active / open offer.
    const isPartiallyClosed = row.status === 'PARTIALLY_PLACED' || row.status === 'CLOSING';
    const forceCloseAction: RowAction | null =
      row.status === 'CLOSING' && canForceCloseOffer
        ? { label: 'Force Close', onClick: () => setForceCloseTarget(row), danger: true }
        : null;
    const reopenAction: RowAction | null =
      isPartiallyClosed && !hasEndorsement && canReopenOffer
        ? { label: 'Reopen Offer', onClick: () => setReopenTarget(row) }
        : null;
    const wantsPartialEdit = isPartiallyClosed || hasRecordedPayment;
    const editAction: RowAction | null = wantsPartialEdit
      ? canPartialEdit
        ? { label: 'Partial Edit', onClick: () => setPartialEditTarget(row) }
        : null
      : canEditOffer
        ? { label: 'Edit Offer', onClick: () => setEditTarget(row) }
        : null;

    return [
      { label: 'View Offer', onClick: () => onView(row) },
      ...(reopenAction ? [reopenAction] : []),
      ...(editAction ? [editAction] : []),
      ...(forceCloseAction ? [forceCloseAction] : []),
      ...(canArchive && canArchiveOffer ? [archiveAction] : []),
      ...extras,
    ];
  };

  const dialogs = (
    <>
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
          onCreated={() => {
            const target = endorseTarget;
            setEndorseTarget(null);
            if (onEndorsementCreated) {
              onEndorsementCreated(target);
            } else {
              router.push(
                `/${tenantSlug}/operations/reinsurance/facultative/${target.id}?tab=endorsement`,
              );
            }
          }}
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
        isOpen={!!forceCloseTarget}
        onClose={() => setForceCloseTarget(null)}
        title="Force Close Placement?"
        description={`This bypasses the normal close workflow and closes "${displayPolicyNumber(
          forceCloseTarget?.policyNumber,
        )}" at its actual placed capacity. Outstanding workflow history is preserved, but the offer will no longer accept changes.`}
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

  return { getRowActions, dialogs };
}
