'use client';

import { useDocumentFileName } from '@/lib/reinsurance/useDocumentFileName';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  DebitNoteContent,
  type DebitNoteContentProps,
} from '@/components/molecules/documents/content/DebitNoteContent';

interface DebitNotePreviewModalProps extends DebitNoteContentProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
}

/** Content-only preview of the debit note. */
export function DebitNotePreviewModal({
  isOpen,
  title,
  onClose,
  ...content
}: DebitNotePreviewModalProps) {
  const fileName = useDocumentFileName({
    documentName: 'Debit Note',
    placement: content.placement,
    recipientName: content.cedantName,
  });

  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={title}
      fileName={fileName}
      printRootId="debit-note-print-root"
      onClose={onClose}
    >
      <DebitNoteContent {...content} />
    </DocumentPreviewShell>
  );
}
