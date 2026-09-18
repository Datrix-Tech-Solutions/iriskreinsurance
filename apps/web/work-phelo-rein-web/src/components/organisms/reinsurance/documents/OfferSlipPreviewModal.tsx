'use client';

import { useDocumentFileName } from '@/lib/reinsurance/useDocumentFileName';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  OfferSlipContent,
  type OfferSlipContentProps,
} from '@/components/molecules/documents/content/OfferSlipContent';

interface OfferSlipPreviewModalProps extends OfferSlipContentProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Content-only preview of the facultative offer slip, opened from the
 *  distribution list's "Preview Slip" action. */
export function OfferSlipPreviewModal({ isOpen, onClose, ...content }: OfferSlipPreviewModalProps) {
  const fileName = useDocumentFileName({
    documentName: 'Offer Slip',
    placement: content.placement,
  });

  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={`Offer Slip — ${content.placement.title}`}
      fileName={fileName}
      printRootId="offer-slip-print-root"
      onClose={onClose}
    >
      <OfferSlipContent {...content} />
    </DocumentPreviewShell>
  );
}
