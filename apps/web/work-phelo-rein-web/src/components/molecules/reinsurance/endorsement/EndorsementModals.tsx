'use client';

import { EditEndorsementPanel } from '@/components/organisms/reinsurance/panels/EditEndorsementPanel';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';
import { EndorsementDocumentModal } from '@/components/organisms/reinsurance/documents/EndorsementDocumentModal';
import { EndorsementClosingSnapshotModal } from '@/components/organisms/reinsurance/documents/EndorsementClosingSnapshotModal';
import { EndorsementSlipPreviewModal } from '@/components/organisms/reinsurance/documents/EndorsementSlipPreviewModal';
import { ReinsurerEntry } from '@/components/molecules/reinsurance/ReinsurerDistributionSelect';
import {
  EndorsementParticipantClosing,
  Facultative,
  PlacementDocument,
  PlacementEndorsement,
  PlacementEndorsementParticipant,
  PlacementEndorsementSummary,
  PlacementNote,
} from '@/types/reinsurance';
import { EndorsementMarketPreviewState } from './types';

interface EndorsementModalsProps {
  placement: Facultative;
  endorsement: PlacementEndorsement;
  endorsementParticipants: PlacementEndorsementParticipant[];
  endorsementClosings: EndorsementParticipantClosing[];
  endorsementNotes: PlacementNote[];
  endorsementSummary: PlacementEndorsementSummary | undefined;

  editPanelOpen: boolean;
  onCloseEditPanel: () => void;

  endorsementSlipPreviewOpen: boolean;
  onCloseEndorsementSlipPreview: () => void;

  marketPreview: EndorsementMarketPreviewState | null;
  onCloseMarketPreview: () => void;

  addPanelOpen: boolean;
  onCloseAddPanel: () => void;
  onAddReinsurers: (entries: ReinsurerEntry[]) => void;
  existingParticipantIds: string[];

  documentPreview: PlacementDocument | null;
  onCloseDocumentPreview: () => void;

  endorsementClosingPreview: EndorsementParticipantClosing | null;
  onCloseEndorsementClosingPreview: () => void;
}

/** Bundles every modal/panel EndorsementCard can open, wired to its state via props. */
export function EndorsementModals({
  placement,
  endorsement,
  endorsementParticipants,
  endorsementClosings,
  endorsementNotes,
  endorsementSummary,
  editPanelOpen,
  onCloseEditPanel,
  endorsementSlipPreviewOpen,
  onCloseEndorsementSlipPreview,
  marketPreview,
  onCloseMarketPreview,
  addPanelOpen,
  onCloseAddPanel,
  onAddReinsurers,
  existingParticipantIds,
  documentPreview,
  onCloseDocumentPreview,
  endorsementClosingPreview,
  onCloseEndorsementClosingPreview,
}: EndorsementModalsProps) {
  return (
    <>
      <EditEndorsementPanel
        isOpen={editPanelOpen}
        placement={placement}
        endorsement={endorsement}
        onClose={onCloseEditPanel}
      />

      <EndorsementSlipPreviewModal
        isOpen={endorsementSlipPreviewOpen}
        placement={placement}
        endorsement={endorsement}
        participants={endorsementParticipants}
        closings={endorsementClosings}
        notes={endorsementNotes}
        summary={endorsementSummary}
        onClose={onCloseEndorsementSlipPreview}
      />

      {marketPreview && (
        <EndorsementSlipPreviewModal
          isOpen={!!marketPreview}
          placement={placement}
          endorsement={endorsement}
          participants={endorsementParticipants}
          closings={endorsementClosings}
          notes={endorsementNotes}
          summary={endorsementSummary}
          documentTitle={marketPreview.documentTitle}
          focusedCounterpartyId={marketPreview.counterpartyId}
          focusedRecipient={{
            name: marketPreview.recipientName,
            relationship: marketPreview.relationship,
            offeredLinePercent: marketPreview.offeredLinePercent,
            status: marketPreview.status,
          }}
          previewFormat={marketPreview.previewFormat}
          brokerageFee={marketPreview.brokerageFee}
          confirmedClosing={marketPreview.confirmedClosing}
          onClose={onCloseMarketPreview}
        />
      )}

      <CreateDistributionPanel
        isOpen={addPanelOpen}
        onClose={onCloseAddPanel}
        onAdd={onAddReinsurers}
        existingIds={existingParticipantIds}
        excludeName={placement.cedant?.name ?? placement.cedantName}
        title="Add Endorsement Participant"
      />

      <EndorsementDocumentModal
        isOpen={!!documentPreview}
        document={documentPreview}
        placement={placement}
        onClose={onCloseDocumentPreview}
      />

      <EndorsementClosingSnapshotModal
        isOpen={!!endorsementClosingPreview}
        placement={placement}
        endorsement={endorsement}
        closing={endorsementClosingPreview}
        onClose={onCloseEndorsementClosingPreview}
      />
    </>
  );
}
