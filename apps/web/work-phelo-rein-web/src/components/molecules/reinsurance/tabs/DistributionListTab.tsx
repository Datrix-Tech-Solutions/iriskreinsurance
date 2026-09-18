'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';
import {
  PlacementShareBreakdown,
  ShareBreakdownEntry,
} from '@/components/molecules/reinsurance/PlacementShareBreakdown';
import {
  DistributionTable,
  DistributionEntry,
} from '@/components/molecules/reinsurance/tables/DistributionTable';
import { Facultative, PlacementParticipant } from '@/types/reinsurance';
import { ReinsurerEntry } from '@/components/molecules/reinsurance/ReinsurerDistributionSelect';
import {
  useReinsurers,
  useAddParticipant,
  useUpdateParticipant,
  useUpdateParticipantStatus,
  useUpdateFacultativeStatus,
  useDeleteParticipant,
  useUpdateClosingStatus,
  useAcceptAndConfirmPlacementParticipant,
  usePlacementClosings,
  usePlacementPayments,
  facultativePlacementKey,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

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

interface DistributionListTabProps {
  placement: Facultative;
}

function participantToEntry(
  p: PlacementParticipant,
  reinsurerEmails: Record<string, string[]>,
): DistributionEntry {
  return {
    id: p.id,
    counterpartyId: p.counterpartyId,
    reinsurerCompany: p.counterparty.name,
    emails: reinsurerEmails[p.counterpartyId] ?? [],
    shareLine: parseFloat(p.sharePercent ?? '0'),
    brokerageFee: parseFloat(p.brokerageFee ?? '0'),
    status: p.status,
  };
}

export function DistributionListTab({ placement }: DistributionListTabProps) {
  const queryClient = useQueryClient();
  const facOffer = placement.facultativeOffer ?? 0;
  const premium = placement.premium ?? 0;

  const { data: reinsurers = [] } = useReinsurers();
  const { mutateAsync: addParticipant, isPending: isAdding } = useAddParticipant(placement.id);
  const { mutateAsync: updateParticipant } = useUpdateParticipant(placement.id);
  const { mutateAsync: updateParticipantStatus } = useUpdateParticipantStatus(placement.id);
  const { mutateAsync: updatePlacementStatus } = useUpdateFacultativeStatus(placement.id);
  const { mutateAsync: deleteParticipant } = useDeleteParticipant(placement.id);
  const { mutateAsync: updateClosingStatus } = useUpdateClosingStatus(placement.id);
  const { mutateAsync: acceptAndConfirmParticipant } = useAcceptAndConfirmPlacementParticipant(
    placement.id,
  );
  const { data: closings = [] } = usePlacementClosings(placement.id);
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const [panelOpen, setPanelOpen] = useState(false);

  const reinsurerEmails = useMemo<Record<string, string[]>>(
    () =>
      Object.fromEntries(
        reinsurers.map((r) => {
          const emails: string[] = [];
          if (r.email) emails.push(r.email);
          r.contacts.forEach((c) => {
            if (c.email) emails.push(c.email);
          });
          return [r.id, emails];
        }),
      ),
    [reinsurers],
  );

  const toEntries = useCallback(
    (participants: PlacementParticipant[]) =>
      participants
        .filter(
          (p) => p.role === 'REINSURER' || p.role === 'LEAD_REINSURER' || p.role === 'CO_REINSURER',
        )
        .map((p) => participantToEntry(p, reinsurerEmails)),
    [reinsurerEmails],
  );

  const confirmedClosingParticipantIds = useMemo(
    () =>
      new Set(
        closings
          .filter((closing) => closing.status === 'CONFIRMED')
          .map((closing) => closing.participantId),
      ),
    [closings],
  );

  const serverEntries = useMemo(
    () =>
      toEntries(placement.participants).map((entry) => ({
        ...entry,
        hasConfirmedClosing: confirmedClosingParticipantIds.has(entry.id),
      })),
    [confirmedClosingParticipantIds, placement.participants, toEntries],
  );

  const [patches, setPatches] = useState<Record<string, Partial<DistributionEntry>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());

  const entries = useMemo(
    () =>
      serverEntries
        .filter((e) => !deletedIds.has(e.id))
        .map((e) => ({ ...e, ...(patches[e.id] ?? {}) })),
    [serverEntries, patches, deletedIds],
  );

  const toast = useToastStore.getState;

  const isPlacementLocked = useMemo(
    () => payments.some((p) => p.status === 'RECORDED'),
    [payments],
  );

  const closingByParticipantId = useMemo(
    () =>
      Object.fromEntries(
        closings.filter((c) => c.status !== 'VOID').map((c) => [c.participantId, c]),
      ),
    [closings],
  );

  const patch = (id: string, update: Partial<DistributionEntry>) =>
    setPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));

  // Optimistic status patches only exist to bridge the gap until the server round-trip lands —
  // once it does, drop them so a leftover patch (e.g. 'ACCEPTED') can't mask a later real status
  // (e.g. 'CLOSED') that the server returns for the same row.
  const clearStatusPatch = (id: string) =>
    setPatches((prev) => {
      if (!prev[id] || !('status' in prev[id])) return prev;
      const rest = { ...prev[id] };
      delete rest.status;
      return { ...prev, [id]: rest };
    });

  const refreshPlacementAfterAccept = useCallback(
    () => queryClient.invalidateQueries({ queryKey: facultativePlacementKey(placement.id) }),
    [placement.id, queryClient],
  );

  const handleAdd = async (newEntries: ReinsurerEntry[]) => {
    const existingIds = new Set(placement.participants.map((p) => p.counterpartyId));
    const reinsurersById = Object.fromEntries(reinsurers.map((r) => [r.id, r]));
    const newOnes = newEntries.filter((e) => !existingIds.has(e.id));

    const results = await Promise.allSettled(
      newOnes.map((e) =>
        addParticipant({
          counterpartyId: e.id,
          role: 'REINSURER',
          sharePercent: facOffer,
          brokerageFee: parseFloat(String(reinsurersById[e.id]?.brokerageFee ?? 0)) || 0,
        }),
      ),
    );

    results.forEach((r) => {
      if (r.status === 'rejected')
        toast().addToast({ message: extractError(r.reason), type: 'error' });
    });

    const anyAdded = results.some((r) => r.status === 'fulfilled');
    if (anyAdded && placement.status === 'DRAFT') {
      updatePlacementStatus({ status: 'MARKETING' }).catch((error) =>
        toast().addToast({ message: extractError(error), type: 'error' }),
      );
    }
  };

  const handleShareCommit = (row: DistributionEntry, share: number) => {
    patch(row.id, { shareLine: share });
    // Also reset signedLinePercent so a previously-accepted (then reverted) participant
    // doesn't leave a stale signed line that exceeds the new sharePercent.
    updateParticipant({
      participantId: row.id,
      sharePercent: share,
      signedLinePercent: share,
    }).catch((error) => toast().addToast({ message: extractError(error), type: 'error' }));
  };

  const handleBrokerageCommit = (row: DistributionEntry, brokerage: number) => {
    patch(row.id, { brokerageFee: brokerage });
    updateParticipant({ participantId: row.id, brokerageFee: brokerage }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleMailSent = (row: DistributionEntry) => {
    // Skip status update when already accepted — ACCEPTED → OFFER_SENT is not a valid transition
    if (row.status === 'ACCEPTED') return;
    updateParticipantStatus({ participantId: row.id, status: 'OFFER_SENT' }).catch((error) =>
      toast().addToast({ message: extractError(error), type: 'error' }),
    );
  };

  const handleAccept = async (row: DistributionEntry) => {
    if (acceptingIds.has(row.id)) return;

    const placedPct = entries
      .filter((e) => e.id !== row.id && (e.status === 'ACCEPTED' || e.status === 'CLOSED'))
      .reduce((sum, e) => sum + e.shareLine, 0);
    const availablePct = Math.max(0, +(facOffer - placedPct).toFixed(4));
    if (row.shareLine > availablePct) {
      toast().addToast({
        message: `${row.reinsurerCompany}'s share (${row.shareLine}%) exceeds the ${availablePct}% still available on this placement.`,
        type: 'error',
      });
      return;
    }

    setAcceptingIds((prev) => new Set([...prev, row.id]));
    patch(row.id, { status: 'ACCEPTED' });

    try {
      await updateParticipant({
        participantId: row.id,
        sharePercent: row.shareLine,
        signedLinePercent: row.shareLine,
        suppressInvalidation: true,
      });
      await updateParticipantStatus({
        participantId: row.id,
        status: 'ACCEPTED',
        suppressInvalidation: true,
      });
    } catch (error) {
      patch(row.id, { status: row.status });
      toast().addToast({ message: extractError(error), type: 'error' });
    } finally {
      await refreshPlacementAfterAccept();
      clearStatusPatch(row.id);
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  const handleClose = async (row: DistributionEntry) => {
    if (acceptingIds.has(row.id)) return;
    setAcceptingIds((prev) => new Set([...prev, row.id]));

    try {
      await acceptAndConfirmParticipant({ participantId: row.id });
      toast().addToast({
        message: `A closing for ${row.reinsurerCompany} with ${row.shareLine}% has been created`,
        type: 'success',
      });
    } catch (error) {
      toast().addToast({ message: extractError(error), type: 'error' });
    } finally {
      await refreshPlacementAfterAccept();
      clearStatusPatch(row.id);
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  const handleRevert = (row: DistributionEntry) => {
    patch(row.id, { status: 'QUOTED' });
    const closing = closingByParticipantId[row.id];
    // Confirmed closings are immutable backend snapshots; do not void from frontend revert flow.
    const canVoidClosing = closing?.status === 'DRAFT' || closing?.status === 'ISSUED';
    const voidClosing = canVoidClosing
      ? updateClosingStatus({ closingId: closing.id, status: 'VOID' })
      : Promise.resolve();
    voidClosing
      .then(() => updateParticipantStatus({ participantId: row.id, status: 'QUOTED' }))
      .catch((error) => {
        patch(row.id, { status: 'ACCEPTED' });
        toast().addToast({ message: extractError(error), type: 'error' });
      });
  };

  const handleDecline = (row: DistributionEntry) => {
    patch(row.id, { status: 'DECLINED', shareLine: 0 });
    // Also reset signedLinePercent so a previously-accepted (then reverted) participant
    // doesn't leave a stale signed line that exceeds the new sharePercent.
    updateParticipant({ participantId: row.id, sharePercent: 0, signedLinePercent: 0 })
      .then(() => updateParticipantStatus({ participantId: row.id, status: 'DECLINED' }))
      .catch((error) => {
        patch(row.id, { status: row.status, shareLine: row.shareLine });
        toast().addToast({ message: extractError(error), type: 'error' });
      });
  };

  const handleReopen = (row: DistributionEntry) => {
    patch(row.id, { status: 'OFFER_SENT' });
    updateParticipantStatus({ participantId: row.id, status: 'OFFER_SENT' }).catch((error) => {
      patch(row.id, { status: 'DECLINED' });
      toast().addToast({ message: extractError(error), type: 'error' });
    });
  };

  const handleDelete = (row: DistributionEntry) => {
    setDeletedIds((prev) => new Set([...prev, row.id]));
    deleteParticipant(row.id).catch((error) => {
      setDeletedIds((prev) => {
        const s = new Set(prev);
        s.delete(row.id);
        return s;
      });
      toast().addToast({ message: extractError(error), type: 'error' });
    });
  };

  const breakdownEntries: ShareBreakdownEntry[] = entries.map((e, i) => ({
    id: e.id,
    label: e.reinsurerCompany,
    value: e.shareLine,
    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    isPlaced: e.status === 'ACCEPTED' || e.status === 'CLOSED',
  }));

  return (
    <>
      <PlacementShareBreakdown
        total={facOffer}
        totalLabel="Fac. Offer"
        entries={breakdownEntries}
        onAddReinsurers={() => setPanelOpen(true)}
        isAdding={isAdding}
      />

      <div className="mt-4">
        <DistributionTable
          entries={entries}
          premium={premium}
          placement={placement}
          isPlacementLocked={isPlacementLocked}
          busyIds={acceptingIds}
          onShareCommit={handleShareCommit}
          onBrokerageCommit={handleBrokerageCommit}
          onMailSent={handleMailSent}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onClose={handleClose}
          onDelete={handleDelete}
          onRevert={handleRevert}
          onReopen={handleReopen}
        />
      </div>

      <CreateDistributionPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onAdd={handleAdd}
        existingIds={placement.participants.map((p) => p.counterpartyId)}
        excludeName={placement.cedant?.name ?? placement.cedantName}
      />
    </>
  );
}
