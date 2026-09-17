'use client';

import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { useDocumentFileName } from '@/lib/reinsurance/useDocumentFileName';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  ClaimDebitNoteContent,
  type ClaimDebitNoteContentProps,
} from '@/components/molecules/documents/content/ClaimDebitNoteContent';

interface ClaimDebitNoteModalProps extends ClaimDebitNoteContentProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Content-only preview of the claim debit note / claim notification. */
export function ClaimDebitNoteModal({ isOpen, onClose, ...content }: ClaimDebitNoteModalProps) {
  const label = content.mode === 'notification' ? 'Claim Notification' : 'Claim Debit Note';
  const fileName = useDocumentFileName({
    documentName: label,
    placement: content.placement,
    recipientName: content.participant.counterparty?.name ?? null,
  });

  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={`${label} — ${displayPolicyNumber(content.placement.policyNumber)}`}
      fileName={fileName}
      printRootId="claim-debit-note-print-root"
      onClose={onClose}
    >
      <ClaimDebitNoteContent {...content} />
    </DocumentPreviewShell>
  );
}
