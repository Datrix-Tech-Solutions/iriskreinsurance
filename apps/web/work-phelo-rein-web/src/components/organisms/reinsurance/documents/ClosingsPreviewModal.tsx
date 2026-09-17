'use client';

import { useDocumentFileName } from '@/lib/reinsurance/useDocumentFileName';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  CreditNoteContent,
  type CreditNoteContentProps,
} from '@/components/molecules/documents/content/CreditNoteContent';

interface ClosingsPreviewModalProps extends CreditNoteContentProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
}

/** Content-only preview of the "Closings" credit note. */
export function ClosingsPreviewModal({
  isOpen,
  title,
  onClose,
  ...content
}: ClosingsPreviewModalProps) {
  const fileName = useDocumentFileName({
    documentName: 'Closings',
    placement: content.placement,
    recipientName: content.reinsurerCompany,
  });

  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={title}
      fileName={fileName}
      printRootId="closings-print-root"
      onClose={onClose}
    >
      <CreditNoteContent {...content} />
    </DocumentPreviewShell>
  );
}
