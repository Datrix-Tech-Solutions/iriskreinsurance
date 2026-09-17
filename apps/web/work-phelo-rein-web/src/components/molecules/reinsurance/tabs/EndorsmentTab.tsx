'use client';

import { useState, useEffect, useRef, Ref, MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  EndorsementParticipantClosing,
  Facultative,
  PlacementEndorsement,
  PlacementEndorsementParticipant,
  PlacementDocument,
  ENDORSEMENT_STATUS_LABELS,
  ENDORSEMENT_STATUS_VARIANT,
} from '@/types/reinsurance';
import {
  usePlacementEndorsements,
  usePlacementEndorsementParticipants,
  useCreateEndorsementParticipant,
  useReinviteEndorsementParticipant,
  useUpdateEndorsementParticipant,
  useUpdateEndorsementParticipantStatus,
  useEndorsementClosings,
  usePlacementDocuments,
  usePlacementEndorsementNotes,
  useValidateAndConfirmEndorsementParticipant,
  usePlacementEndorsementSummary,
  usePlacementEffectiveView,
  useReinsurers,
  useUpdateEndorsementStatus,
  useForceCloseEndorsement,
  endorsementParticipantKey,
  endorsementClosingsKey,
  endorsementSummaryKey,
  endorsementKey,
  placementDocumentsKey,
  placementEffectiveViewKey,
  facultativePlacementKey,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { useToastStore } from '@/store/toast.store';
import { ReinsurerEntry } from '@/components/molecules/reinsurance/ReinsurerDistributionSelect';
import {
  getSnapshotPlacement,
  getSnapshotParticipants,
} from '@/lib/reinsurance/endorsementSnapshot';
import { cardClass, cn } from '@/lib/utils';
import { EffectivePlacementSection } from '@/components/molecules/reinsurance/endorsement/EffectivePlacementSection';
import { EndorsementHeader } from '@/components/molecules/reinsurance/endorsement/EndorsementHeader';
import { EndorsementSummaryLine } from '@/components/molecules/reinsurance/endorsement/EndorsementSummaryLine';
import { EndorsementCapacitySection } from '@/components/molecules/reinsurance/endorsement/EndorsementCapacitySection';
import { EndorsementParticipantsTable } from '@/components/molecules/reinsurance/endorsement/EndorsementParticipantsTable';
import { EndorsementCloseSection } from '@/components/molecules/reinsurance/endorsement/EndorsementCloseSection';
import { EndorsementModals } from '@/components/molecules/reinsurance/endorsement/EndorsementModals';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  EndorsementMarketPreviewState,
  EndorsementParticipantRow,
} from '@/components/molecules/reinsurance/endorsement/types';

interface EndorsementTabProps {
  placement: Facultative;
}

const SEGMENT_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#84cc16',
  '#f59e0b',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#10b981',
];

function EndorsementCard({
  endorsement,
  placement,
  defaultOpen = false,
  cardRef,
}: {
  endorsement: PlacementEndorsement;
  placement: Facultative;
  defaultOpen?: boolean;
  cardRef?: Ref<HTMLDivElement>;
}) {
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(defaultOpen);
  const [revisedShares, setRevisedShares] = useState<Record<string, string>>({});
  const [busyEPIds, setBusyEPIds] = useState<Set<string>>(new Set());
  const [marketPreview, setMarketPreview] = useState<EndorsementMarketPreviewState | null>(null);
  const [endorsementSlipPreviewOpen, setEndorsementSlipPreviewOpen] = useState(false);
  const [endorsementClosingPreview, setEndorsementClosingPreview] =
    useState<EndorsementParticipantClosing | null>(null);
  const [documentPreview, setDocumentPreview] = useState<PlacementDocument | null>(null);
  const [mailedIds, setMailedIds] = useState<Set<string>>(new Set());
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [pendingValidation, setPendingValidation] = useState<{
    row: EndorsementParticipantRow;
    share: number;
  } | null>(null);
  const [editingCounterpartyIds, setEditingCounterpartyIds] = useState<Set<string>>(new Set());

  const canManage = useAnyPermissionRules(RiPerm.manageEndorsement);

  const cardElRef = useRef<HTMLDivElement | null>(null);
  const setCardRef = (node: HTMLDivElement | null) => {
    cardElRef.current = node;
    if (typeof cardRef === 'function') cardRef(node);
    else if (cardRef) (cardRef as MutableRefObject<HTMLDivElement | null>).current = node;
  };

  const { data: reinsurers = [] } = useReinsurers();

  const {
    mutate: updateStatus,
    mutateAsync: updateStatusAsync,
    isPending: isUpdatingStatus,
  } = useUpdateEndorsementStatus(placement.id);
  const { mutateAsync: forceCloseEndorsementAsync, isPending: isForceClosingEndorsement } =
    useForceCloseEndorsement(placement.id);
  const { data: endorsementParticipants = [] } = usePlacementEndorsementParticipants(
    placement.id,
    endorsement.id,
  );
  const { data: endorsementSummary } = usePlacementEndorsementSummary(placement.id, endorsement.id);
  const { data: endorsementClosings = [] } = useEndorsementClosings(placement.id, endorsement.id);
  const { data: endorsementNotes = [] } = usePlacementEndorsementNotes(
    placement.id,
    endorsement.id,
  );
  const { data: placementDocuments = [] } = usePlacementDocuments(placement.id);
  const { mutateAsync: createEndorsementParticipant } = useCreateEndorsementParticipant(
    placement.id,
    endorsement.id,
  );
  const reinviteEndorsementParticipant = useReinviteEndorsementParticipant(
    placement.id,
    endorsement.id,
  );
  const updateEndorsementParticipant = useUpdateEndorsementParticipant(
    placement.id,
    endorsement.id,
  );
  const updateEndorsementParticipantStatus = useUpdateEndorsementParticipantStatus(
    placement.id,
    endorsement.id,
  );
  const validateAndConfirmEndorsementParticipant = useValidateAndConfirmEndorsementParticipant(
    placement.id,
    endorsement.id,
  );
  const queryClient = useQueryClient();

  const prevStatusRef = useRef(endorsement.status);
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = endorsement.status;
    // Leaving DRAFT reveals the participants table and close section, growing the
    // card — scroll the newly added content into view the same way tab-selection does.
    if (prevStatus === 'DRAFT' && endorsement.status !== 'DRAFT' && detailsOpen) {
      requestAnimationFrame(() => {
        cardElRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    }
  }, [endorsement.status, detailsOpen]);

  const original = getSnapshotPlacement(endorsement.originalSnapshot);
  const proposed = endorsement.proposedSnapshot
    ? getSnapshotPlacement(endorsement.proposedSnapshot)
    : null;

  const snapshotParticipants = getSnapshotParticipants(endorsement.originalSnapshot).filter(
    (p) => p.role === 'REINSURER' || p.role === 'LEAD_REINSURER' || p.role === 'CO_REINSURER',
  );

  const snapshotFacOffer = parseFloat(String(original.facultativeOffer ?? 0));
  const proposedFacOffer = proposed
    ? parseFloat(String(proposed.facultativeOffer ?? snapshotFacOffer))
    : snapshotFacOffer;

  const snapshotCounterpartyIds = new Set(
    snapshotParticipants.map((p) => String(p.counterpartyId)),
  );

  const acceptedCounterpartyIds = new Set(
    endorsementParticipants
      .filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED')
      .map((p) => p.counterpartyId),
  );

  // Re-inviting a declined participant preserves the declined row for history
  // and creates a new one — a counterparty can briefly have more than one
  // endorsement participant record. Only the most recently created attempt
  // per counterparty should drive the table row, not just the first match.
  const latestEndorsementParticipantByCounterpartyId = new Map<
    string,
    PlacementEndorsementParticipant
  >();
  for (const p of endorsementParticipants) {
    const existing = latestEndorsementParticipantByCounterpartyId.get(p.counterpartyId);
    if (!existing || new Date(p.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
      latestEndorsementParticipantByCounterpartyId.set(p.counterpartyId, p);
    }
  }

  const snapshotRows: EndorsementParticipantRow[] = snapshotParticipants.map((p) => {
    const r = reinsurers.find((r) => r.id === p.counterpartyId);
    const cid = String(p.counterpartyId);
    const endorsementParticipant = latestEndorsementParticipantByCounterpartyId.get(cid);
    const originalShare = parseFloat(String(p.signedLinePercent ?? p.sharePercent ?? '0'));
    const originalParticipantId =
      typeof p.originalParticipantId === 'string'
        ? p.originalParticipantId
        : typeof p.id === 'string' && p.sourceType !== 'ENDORSEMENT_CLOSING'
          ? p.id
          : null;
    return {
      id: endorsementParticipant?.id ?? cid,
      participantId: endorsementParticipant?.id,
      originalParticipantId,
      counterpartyId: cid,
      reinsurerName: endorsementParticipant?.counterparty?.name ?? r?.name ?? cid,
      originalShare,
      offeredShare: parseFloat(endorsementParticipant?.sharePercent ?? String(originalShare)),
      brokerageFee: parseFloat(String(p.brokerageFee ?? '0')),
      isNew: false,
    };
  });

  const extraRows: EndorsementParticipantRow[] = Array.from(
    latestEndorsementParticipantByCounterpartyId.values(),
  )
    .filter((p) => !snapshotCounterpartyIds.has(p.counterpartyId))
    .map((p) => {
      const r = reinsurers.find((r) => r.id === p.counterpartyId);
      const cid = String(p.counterpartyId);
      return {
        id: p.id,
        participantId: p.id,
        counterpartyId: cid,
        reinsurerName: p.counterparty?.name ?? r?.name ?? cid,
        originalShare: 0,
        offeredShare: parseFloat(p.sharePercent ?? '0'),
        brokerageFee: parseFloat(String(r?.brokerageFee ?? '0')),
        isNew: true,
      };
    });

  const endorsementRows: EndorsementParticipantRow[] = [...snapshotRows, ...extraRows];

  const capacityColorMap = Object.fromEntries(
    endorsementRows.map((r, i) => [r.counterpartyId, SEGMENT_COLORS[i % SEGMENT_COLORS.length]]),
  );
  const acceptedCapacityRows = endorsementRows
    .filter((r) => acceptedCounterpartyIds.has(r.counterpartyId))
    .map((r) => {
      const ep = latestEndorsementParticipantByCounterpartyId.get(r.counterpartyId);
      const share = parseFloat(String(ep?.signedLinePercent ?? ep?.sharePercent ?? r.offeredShare));
      return { ...r, share: Number.isFinite(share) ? share : 0 };
    });

  const summaryTargetPercent = endorsementSummary?.targetPercent ?? proposedFacOffer;
  const summaryAcceptedPercent = endorsementSummary?.acceptedPercent ?? 0;
  const acceptedRemainingPercent = Math.max(
    0,
    +(summaryTargetPercent - summaryAcceptedPercent).toFixed(4),
  );
  const leftoverFacOffer = acceptedRemainingPercent;

  const invalidateEndorsementView = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: endorsementParticipantKey(placement.id, endorsement.id),
      }),
      queryClient.invalidateQueries({
        queryKey: endorsementClosingsKey(placement.id, endorsement.id),
      }),
      queryClient.invalidateQueries({
        queryKey: endorsementSummaryKey(placement.id, endorsement.id),
      }),
      queryClient.invalidateQueries({
        queryKey: [...endorsementKey(placement.id), endorsement.id, 'notes'],
      }),
      queryClient.invalidateQueries({
        queryKey: placementDocumentsKey(placement.id),
      }),
      queryClient.invalidateQueries({
        queryKey: placementEffectiveViewKey(placement.id),
      }),
      queryClient.invalidateQueries({
        queryKey: facultativePlacementKey(placement.id),
        exact: true,
      }),
    ]);
  };

  const activePlacementDocuments = placementDocuments.filter(
    (document) => document.status !== 'VOID',
  );
  const endorsementSlipDocument = activePlacementDocuments.find(
    (document) => document.type === 'ENDORSEMENT_SLIP' && document.endorsementId === endorsement.id,
  );

  const handleViewEndorsementSlip = () => {
    if (endorsementSlipDocument) {
      setDocumentPreview(endorsementSlipDocument);
      return;
    }
    setEndorsementSlipPreviewOpen(true);
  };

  const handlePreviewMarketDocument = (row: EndorsementParticipantRow) => {
    const endorsementParticipant = latestEndorsementParticipantByCounterpartyId.get(
      row.counterpartyId,
    );
    const offeredLine = Number(
      endorsementParticipant?.signedLinePercent ??
        endorsementParticipant?.sharePercent ??
        revisedShares[row.counterpartyId] ??
        row.offeredShare,
    );
    const isExistingPlacementParticipant =
      !row.isNew || Boolean(endorsementParticipant?.originalParticipantId);

    setMarketPreview({
      counterpartyId: row.counterpartyId,
      documentTitle: isExistingPlacementParticipant
        ? 'Revised Endorsement Offer Preview'
        : 'Offer Slip',
      recipientName: row.reinsurerName,
      relationship: isExistingPlacementParticipant
        ? 'Existing placement participant reviewing revised endorsement terms'
        : 'New endorsement participant reviewing current endorsed risk',
      offeredLinePercent: Number.isFinite(offeredLine) ? offeredLine : row.offeredShare,
      status: endorsementParticipant?.status ?? 'NOT_SENT',
      brokerageFee: row.brokerageFee,
      previewFormat: isExistingPlacementParticipant ? 'REVISED_CERTIFICATE' : 'OFFER_SLIP',
    });
  };

  const handleAddReinsurers = async (entries: ReinsurerEntry[]) => {
    try {
      const existingIds = new Set(endorsementRows.map((row) => row.counterpartyId));
      const newEntries = entries.filter((entry) => !existingIds.has(entry.id));
      await Promise.all(
        newEntries.map((entry) =>
          createEndorsementParticipant({
            counterpartyId: entry.id,
            sharePercent: leftoverFacOffer > 0 ? leftoverFacOffer : undefined,
          }),
        ),
      );
      if (newEntries.length > 0) {
        useToastStore.getState().addToast({
          message: 'Endorsement participant added',
          type: 'success',
        });
      }
      setAddPanelOpen(false);
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleMailReinsurer = (counterpartyId: string) => {
    const participant = latestEndorsementParticipantByCounterpartyId.get(counterpartyId);
    if (participant && participant.status === 'INVITED') {
      updateEndorsementParticipantStatus
        .mutateAsync({ participantId: participant.id, status: 'OFFER_SENT' })
        .catch((error) => {
          useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
        });
    }
    setMailedIds((prev) => new Set([...prev, counterpartyId]));
  };

  const handleRejectEndorsementParticipant = async (row: EndorsementParticipantRow) => {
    if (!row.participantId || busyEPIds.has(row.counterpartyId)) return;
    setBusyEPIds((prev) => new Set([...prev, row.counterpartyId]));
    try {
      await updateEndorsementParticipantStatus.mutateAsync({
        participantId: row.participantId,
        status: 'DECLINED',
      });
      useToastStore.getState().addToast({
        message: `${row.reinsurerName} declined for this endorsement`,
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    } finally {
      setBusyEPIds((prev) => {
        const n = new Set(prev);
        n.delete(row.counterpartyId);
        return n;
      });
    }
  };

  // ACCEPTED is not a terminal endorsement participant status, so the revised
  // share can be edited and resubmitted in place — there is no backend
  // "revert to pending" transition from ACCEPTED, only ACCEPTED -> CLOSED.
  // This just re-opens the row's share input locally; re-accepting sends the
  // update with status still ACCEPTED.
  const handleEditRevisedOffer = (row: EndorsementParticipantRow) => {
    setEditingCounterpartyIds((prev) => new Set([...prev, row.counterpartyId]));
  };

  const handleReopenEndorsementParticipant = async (row: EndorsementParticipantRow) => {
    if (!row.participantId || busyEPIds.has(row.counterpartyId)) return;
    setBusyEPIds((prev) => new Set([...prev, row.counterpartyId]));
    try {
      // DECLINED has no valid status transition on the backend — reopening a
      // declined participant goes through the dedicated reinvite endpoint,
      // which preserves the declined row for history and creates a fresh
      // INVITED attempt for the same reinsurer.
      await reinviteEndorsementParticipant.mutateAsync({ participantId: row.participantId });
      await invalidateEndorsementView();
      // The new attempt starts back at INVITED and needs its own offer sent
      // before it can move to OFFER_SENT and then be accepted — mailedIds is
      // keyed by counterparty, so without clearing it here the row would
      // still read as "already sent" from the declined attempt and skip
      // straight to Accept, which the backend rejects (INVITED -> ACCEPTED
      // isn't a valid transition).
      setMailedIds((prev) => {
        const n = new Set(prev);
        n.delete(row.counterpartyId);
        return n;
      });
      useToastStore.getState().addToast({
        message: `${row.reinsurerName} re-invited for this endorsement`,
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    } finally {
      setBusyEPIds((prev) => {
        const n = new Set(prev);
        n.delete(row.counterpartyId);
        return n;
      });
    }
  };

  const handleValidateEndorsementParticipant = async (row: EndorsementParticipantRow) => {
    const participant = row.participantId
      ? endorsementParticipants.find((item) => item.id === row.participantId)
      : endorsementParticipants.find((item) => item.counterpartyId === row.counterpartyId);
    if (!participant || participant.status !== 'ACCEPTED' || busyEPIds.has(row.counterpartyId)) {
      return;
    }
    setBusyEPIds((prev) => new Set([...prev, row.counterpartyId]));

    try {
      await validateAndConfirmEndorsementParticipant.mutateAsync({
        participantId: participant.id,
      });

      useToastStore.getState().addToast({
        message: 'Endorsement participant validated and closing confirmed successfully.',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({
        message: extractError(error),
        type: 'error',
      });
    } finally {
      await invalidateEndorsementView();
      setBusyEPIds((prev) => {
        const n = new Set(prev);
        n.delete(row.counterpartyId);
        return n;
      });
    }
  };

  // Endorsement certificates are only meaningful for original/revised participants whose
  // terms actually changed — a brand-new participant's confirmed closing already reflects
  // their agreed offer, with nothing "endorsed" to certify against. Rendered live from the
  // confirmed closing's own figures, the same way the pre-close "Endorsement Offer Slip"
  // preview is computed — no backend document generation involved.
  const handleViewCertificate = (
    row: EndorsementParticipantRow,
    closing: EndorsementParticipantClosing,
  ) => {
    if (row.isNew) return;
    setMarketPreview({
      counterpartyId: row.counterpartyId,
      documentTitle: 'Endorsement Certificate',
      recipientName: row.reinsurerName,
      relationship: 'Existing placement participant with a confirmed endorsement closing',
      offeredLinePercent: Number(closing.signedLinePercent),
      status: 'CLOSED',
      brokerageFee: row.brokerageFee,
      previewFormat: 'REVISED_CERTIFICATE',
      confirmedClosing: closing,
    });
  };

  const handleAcceptEndorsement = async (row: EndorsementParticipantRow) => {
    const revised = parseFloat(revisedShares[row.counterpartyId] ?? String(row.offeredShare));
    const share = isNaN(revised) ? row.offeredShare : revised;

    // Re-accepting an already-accepted participant replaces their existing
    // signed line rather than adding on top of it — credit that share back
    // before checking it against the leftover capacity, otherwise it's
    // counted as already spent against itself.
    const existingParticipant = latestEndorsementParticipantByCounterpartyId.get(
      row.counterpartyId,
    );
    const existingAcceptedShare =
      existingParticipant?.status === 'ACCEPTED'
        ? parseFloat(
            String(existingParticipant.signedLinePercent ?? existingParticipant.sharePercent ?? 0),
          )
        : 0;
    const availableForRow =
      leftoverFacOffer + (Number.isFinite(existingAcceptedShare) ? existingAcceptedShare : 0);

    if (share > availableForRow) {
      useToastStore.getState().addToast({
        message: `${row.reinsurerName}'s share (${share}%) exceeds the ${availableForRow}% still available on this endorsement.`,
        type: 'error',
      });
      return;
    }

    setBusyEPIds((prev) => new Set([...prev, row.counterpartyId]));
    try {
      const originalParticipant = placement.participants.find(
        (p) => p.counterpartyId === row.counterpartyId,
      );
      const originalParticipantId = row.originalParticipantId ?? originalParticipant?.id;

      let participantId = row.participantId;
      if (participantId) {
        await updateEndorsementParticipant.mutateAsync({
          participantId,
          sharePercent: row.offeredShare,
          signedLinePercent: share,
          status: 'ACCEPTED',
          suppressInvalidation: true,
        });
      } else {
        const created = await createEndorsementParticipant({
          counterpartyId: row.counterpartyId,
          ...(originalParticipantId ? { originalParticipantId } : {}),
          sharePercent: share,
          signedLinePercent: share,
          status: 'ACCEPTED',
        });
        participantId = created.id;
      }

      await invalidateEndorsementView();
      useToastStore.getState().addToast({
        message: `${row.reinsurerName} accepted for this endorsement`,
        type: 'success',
      });
      setEditingCounterpartyIds((prev) => {
        const n = new Set(prev);
        n.delete(row.counterpartyId);
        return n;
      });
      // Accept and validate are separate steps — prompt to validate now
      // rather than confirming the closing automatically. Declining the
      // prompt re-opens the revised offer for editing instead of locking
      // in the acceptance.
      setPendingValidation({ row: { ...row, participantId }, share });
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    } finally {
      setBusyEPIds((prev) => {
        const n = new Set(prev);
        n.delete(row.counterpartyId);
        return n;
      });
    }
  };

  const handleConfirmValidationPrompt = async () => {
    if (!pendingValidation) return;
    const { row } = pendingValidation;
    setPendingValidation(null);
    await handleValidateEndorsementParticipant(row);
  };

  const handleDeclineValidationPrompt = () => {
    if (!pendingValidation) return;
    handleEditRevisedOffer(pendingValidation.row);
    setPendingValidation(null);
  };

  const confirmedClosingByEndorsementParticipantId = Object.fromEntries(
    endorsementClosings
      .filter((closing) => closing.status === 'CONFIRMED')
      .map((closing) => [closing.endorsementParticipantId, closing]),
  );

  const isReadyToClose = endorsementSummary?.canClose ?? false;
  const pendingParticipantsCount = endorsementSummary
    ? endorsementSummary.participants.total -
      endorsementSummary.participants.accepted -
      endorsementSummary.participants.declined
    : 0;
  // Force close is only offered once every invited participant has responded
  // (accepted or declined) but the endorsement still can't reach full target
  // capacity — it is a fallback for a stalled endorsement, not a shortcut
  // around waiting on outstanding invitations.
  const canForceClose =
    !isReadyToClose &&
    endorsement.status !== 'CLOSED' &&
    pendingParticipantsCount === 0 &&
    (endorsementSummary?.participants.accepted ?? 0) > 0;
  const isInClosingPhase =
    !isReadyToClose &&
    endorsement.status !== 'CLOSED' &&
    (endorsementSummary?.closings.confirmed ?? 0) > 0;
  const displayedStatusLabel =
    endorsement.status === 'CLOSED'
      ? ENDORSEMENT_STATUS_LABELS[endorsement.status]
      : isReadyToClose
        ? 'Ready to Close'
        : isInClosingPhase
          ? 'Closing'
          : ENDORSEMENT_STATUS_LABELS[endorsement.status];
  const displayedStatusVariant =
    endorsement.status === 'CLOSED'
      ? ENDORSEMENT_STATUS_VARIANT[endorsement.status]
      : isReadyToClose
        ? 'success'
        : isInClosingPhase
          ? 'warning'
          : ENDORSEMENT_STATUS_VARIANT[endorsement.status];

  const handleCloseEndorsement = async () => {
    if (!isReadyToClose || isUpdatingStatus) return;
    try {
      await updateStatusAsync({ endorsementId: endorsement.id, status: 'CLOSED' });
      await invalidateEndorsementView();
      useToastStore.getState().addToast({
        message: 'Endorsement closed',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({
        message: extractError(error),
        type: 'error',
      });
    }
  };

  const handleForceCloseEndorsement = async () => {
    if (!canForceClose || isForceClosingEndorsement) return;
    try {
      await forceCloseEndorsementAsync({ endorsementId: endorsement.id });
      await invalidateEndorsementView();
      useToastStore.getState().addToast({
        message: 'Endorsement force closed at agreed participant lines',
        type: 'success',
      });
    } catch (error) {
      useToastStore.getState().addToast({
        message: extractError(error),
        type: 'error',
      });
    }
  };

  const summaryCurrency = (proposed?.currency ?? original.currency) as unknown;

  return (
    <>
      <div ref={setCardRef} className={cardClass('p-5 flex flex-col gap-4')}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setDetailsOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDetailsOpen((v) => !v);
            }
          }}
          className="cursor-pointer flex flex-col gap-2"
        >
          <EndorsementHeader
            endorsement={endorsement}
            displayedStatusLabel={displayedStatusLabel}
            displayedStatusVariant={displayedStatusVariant}
            isUpdatingStatus={isUpdatingStatus}
            isOpen={detailsOpen}
            canManage={canManage}
            onEdit={() => setEditPanelOpen(true)}
            onSendToMarket={() =>
              updateStatus({ endorsementId: endorsement.id, status: 'MARKETING' })
            }
            endorsementSlipDocument={endorsementSlipDocument}
            onViewEndorsementSlip={handleViewEndorsementSlip}
          />
          <EndorsementSummaryLine
            participantCount={endorsementRows.length}
            sumInsured={proposed?.sumInsured ?? original.sumInsured}
            premium={proposed?.premium ?? original.premium}
            offerPercent={summaryTargetPercent}
            currency={summaryCurrency}
          />
        </div>

        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-600 ease-in-out',
            detailsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              key={detailsOpen ? 'open' : 'closed'}
              className={cn(
                'flex flex-col gap-5 mt-4 border-t border-gray-100 pt-4',
                detailsOpen && 'metric-slide-up',
              )}
            >
              {/* Reason */}
              {endorsement.reason && (
                <p className="text-sm text-gray-600 border-l-2 border-orange-300 pl-3">
                  {endorsement.reason}
                </p>
              )}

              <EndorsementCapacitySection
                isDraft={endorsement.status === 'DRAFT'}
                isClosed={endorsement.status === 'CLOSED'}
                original={original}
                proposed={proposed}
                endorsementSummary={endorsementSummary}
                summaryTargetPercent={summaryTargetPercent}
                originalPercent={snapshotFacOffer}
                acceptedCapacityRows={acceptedCapacityRows}
                capacityColorMap={capacityColorMap}
              />

              {endorsement.status !== 'DRAFT' && (
                <EndorsementParticipantsTable
                  rows={endorsementRows}
                  endorsementParticipants={endorsementParticipants}
                  isEndorsementClosed={endorsement.status === 'CLOSED'}
                  canManage={canManage}
                  acceptedCounterpartyIds={acceptedCounterpartyIds}
                  editingCounterpartyIds={editingCounterpartyIds}
                  confirmedClosingByEndorsementParticipantId={
                    confirmedClosingByEndorsementParticipantId
                  }
                  busyEPIds={busyEPIds}
                  mailedIds={mailedIds}
                  revisedShares={revisedShares}
                  onRevisedShareChange={(counterpartyId, value) =>
                    setRevisedShares((prev) => ({ ...prev, [counterpartyId]: value }))
                  }
                  hasAvailableCapacity={leftoverFacOffer > 0}
                  onAddParticipant={() => setAddPanelOpen(true)}
                  onPreviewMarketDocument={handlePreviewMarketDocument}
                  onMailReinsurer={handleMailReinsurer}
                  onAccept={handleAcceptEndorsement}
                  onReject={handleRejectEndorsementParticipant}
                  onEditRevision={handleEditRevisedOffer}
                  onReopen={handleReopenEndorsementParticipant}
                  onValidate={handleValidateEndorsementParticipant}
                  onViewClosing={(closing) => setEndorsementClosingPreview(closing)}
                  onViewCertificate={handleViewCertificate}
                />
              )}

              {endorsement.status !== 'DRAFT' && (
                <EndorsementCloseSection
                  isClosed={endorsement.status === 'CLOSED'}
                  isUpdatingStatus={isUpdatingStatus || isForceClosingEndorsement}
                  isReadyToClose={isReadyToClose}
                  canForceClose={canForceClose}
                  canManage={canManage}
                  acceptedPercent={endorsementSummary?.acceptedPercent ?? 0}
                  targetPercent={endorsementSummary?.targetPercent ?? null}
                  onClose={handleCloseEndorsement}
                  onForceClose={handleForceCloseEndorsement}
                />
              )}

              <Modal
                isOpen={!!pendingValidation}
                onClose={() => setPendingValidation(null)}
                title="Validate Endorsement Participant?"
                description={
                  pendingValidation
                    ? `${pendingValidation.row.reinsurerName} has been accepted at ${pendingValidation.share}%. Validate now to issue and confirm their closing, or change the offer to edit their revised share again.`
                    : undefined
                }
                footer={
                  <>
                    <Button variant="secondary" size="sm" onClick={handleDeclineValidationPrompt}>
                      Change Offer
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={busyEPIds.has(pendingValidation?.row.counterpartyId ?? '')}
                      onClick={handleConfirmValidationPrompt}
                    >
                      Validate
                    </Button>
                  </>
                }
              />
            </div>
          </div>
        </div>
      </div>

      <EndorsementModals
        placement={placement}
        endorsement={endorsement}
        endorsementParticipants={endorsementParticipants}
        endorsementClosings={endorsementClosings}
        endorsementNotes={endorsementNotes}
        endorsementSummary={endorsementSummary}
        editPanelOpen={editPanelOpen}
        onCloseEditPanel={() => setEditPanelOpen(false)}
        endorsementSlipPreviewOpen={endorsementSlipPreviewOpen}
        onCloseEndorsementSlipPreview={() => setEndorsementSlipPreviewOpen(false)}
        marketPreview={marketPreview}
        onCloseMarketPreview={() => setMarketPreview(null)}
        addPanelOpen={addPanelOpen}
        onCloseAddPanel={() => setAddPanelOpen(false)}
        onAddReinsurers={handleAddReinsurers}
        existingParticipantIds={endorsementRows.map((r) => r.counterpartyId)}
        documentPreview={documentPreview}
        onCloseDocumentPreview={() => setDocumentPreview(null)}
        endorsementClosingPreview={endorsementClosingPreview}
        onCloseEndorsementClosingPreview={() => setEndorsementClosingPreview(null)}
      />
    </>
  );
}

export function EndorsementTab({ placement }: EndorsementTabProps) {
  const { data: endorsements = [], isLoading } = usePlacementEndorsements(placement.id);
  const {
    data: effectiveView,
    isLoading: effectiveViewLoading,
    isError: effectiveViewError,
  } = usePlacementEffectiveView(placement.id, endorsements.length > 0);

  const openCardRef = useRef<HTMLDivElement>(null);
  const latestEndorsementId =
    endorsements.length > 0
      ? endorsements.reduce((latest, e) =>
          new Date(e.createdAt) > new Date(latest.createdAt) ? e : latest,
        ).id
      : null;

  // Scroll to the bottom of the open (latest) endorsement card whenever this tab
  // is selected — with a single endorsement that lands at the page bottom anyway.
  useEffect(() => {
    if (!latestEndorsementId) return;
    const raf = requestAnimationFrame(() => {
      openCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    return () => cancelAnimationFrame(raf);
  }, [latestEndorsementId]);

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-base font-semibold text-gray-900">Policy Endorsement</h3>

      {endorsements.length > 0 && (
        <EffectivePlacementSection
          view={effectiveView}
          isLoading={effectiveViewLoading}
          isError={effectiveViewError}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading endorsements…</p>
      ) : endorsements.length === 0 ? (
        <p className="text-sm text-gray-400">No endorsements have been made on this policy.</p>
      ) : (
        endorsements.map((e) => (
          <EndorsementCard
            key={e.id}
            endorsement={e}
            placement={placement}
            defaultOpen={e.id === latestEndorsementId}
            cardRef={e.id === latestEndorsementId ? openCardRef : undefined}
          />
        ))
      )}
    </div>
  );
}
