'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  openPdfPreview,
  preloadDocumentPdfDeps,
  renderPrintRootToPdf,
  stagePrintRoot,
} from '@/lib/reinsurance/renderDocumentPdf';
import { DocumentPrintLayout } from '@/components/organisms/reinsurance/documents/DocumentPrintLayout';

interface DocumentPreviewShellProps {
  isOpen: boolean;
  title: string;
  /** Unique id for this document type's hidden print root. */
  printRootId: string;
  /**
   * Name for the generated PDF — e.g. "Debit Note_POL123_Acme Ltd" from
   * `buildDocumentFileName`. Drives the preview tab title and the Download
   * button. Falls back to the on-screen title.
   */
  fileName?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Shared modal for a content-only document preview. The modal shows the bare
 * document body; Print composes it into the full branded page — letterhead,
 * footer and watermark from `DocumentPrintLayout` — and opens it as a named
 * PDF preview in a new tab.
 */
export function DocumentPreviewShell({
  isOpen,
  title,
  printRootId,
  fileName,
  onClose,
  children,
}: DocumentPreviewShellProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  // Warm html2canvas-pro + jsPDF while the user reads the preview, so the first
  // Print click isn't spent downloading them.
  useEffect(() => {
    if (isOpen) preloadDocumentPdfDeps();
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const printTitle = title.replace(/\s*—\s*/, ' - ');
  const documentName = fileName?.trim() || printTitle;

  const handlePrint = async () => {
    const el = document.getElementById(printRootId);
    if (!el || isPrinting) return;

    // Open the tab synchronously so popup blockers treat it as click-driven.
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.title = documentName;
      printWindow.document.body.innerHTML =
        '<p style="font-family: sans-serif; padding: 24px; color: #6b7280;">Preparing document…</p>';
    }

    setIsPrinting(true);
    const restore = stagePrintRoot(el);
    try {
      const blob = await renderPrintRootToPdf(el, documentName);
      if (printWindow && !printWindow.closed) {
        await openPdfPreview(printWindow, blob, documentName);
      }
    } catch (error) {
      console.error('Failed to generate document PDF', error);
      if (printWindow && !printWindow.closed) {
        printWindow.document.body.innerHTML =
          '<p style="font-family: sans-serif; padding: 24px; color: #b91c1c;">Could not generate the document. Please try again.</p>';
      }
    } finally {
      restore();
      setIsPrinting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        width="sm:w-[44vw] sm:max-w-[44vw]"
        height="sm:h-[88vh] sm:max-h-[88vh]"
        fullScreenMobile
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handlePrint} isLoading={isPrinting} loadingText="Preparing…">
              Print
            </Button>
          </>
        }
      >
        <div className="pt-2">{children}</div>
      </Modal>

      <DocumentPrintLayout rootId={printRootId} documentTitle={printTitle} afterContent={null}>
        {children}
      </DocumentPrintLayout>
    </>
  );
}
