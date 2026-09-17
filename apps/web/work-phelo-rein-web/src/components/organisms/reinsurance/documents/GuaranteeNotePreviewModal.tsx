'use client';

import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { useDocumentFileName } from '@/lib/reinsurance/useDocumentFileName';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  GuaranteeNoteContent,
  type GuaranteeNoteContentProps,
} from '@/components/molecules/documents/content/GuaranteeNoteContent';

interface GuaranteeNotePreviewModalProps extends GuaranteeNoteContentProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Content-only preview of the guarantee note. */
export function GuaranteeNotePreviewModal({
  isOpen,
  onClose,
  ...content
}: GuaranteeNotePreviewModalProps) {
  const policyNumber = content.policyNumberOverride ?? content.placement.policyNumber;
  const fileName = useDocumentFileName({
    documentName: 'Guarantee Note',
    placement: content.placement,
    policyNumber,
  });

  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={`Guarantee Note — ${displayPolicyNumber(policyNumber)}`}
      fileName={fileName}
      printRootId="guarantee-note-print-root"
      onClose={onClose}
    >
      <GuaranteeNoteContent {...content} />
    </DocumentPreviewShell>
  );
}
