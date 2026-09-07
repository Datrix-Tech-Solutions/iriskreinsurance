'use client';

import { ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'react-qr-code';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { CompanyLogo } from '@/components/atoms/CompanyLogo';
import { DocumentPrintLayout } from '@/components/organisms/reinsurance/documents/DocumentPrintLayout';
import {
  openPdfPreview,
  preloadDocumentPdfDeps,
  renderPrintRootToPdf,
  stagePrintRoot,
} from '@/lib/reinsurance/renderDocumentPdf';

const COMPANY_URL = 'https://iriskmanagement.net/reinsurance/';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  title: string;
  documentTitle: string;
  /** Name used for the saved PDF when printing — e.g. "Debit Note-POL123-Acme Ltd". Falls back to documentTitle. */
  fileName?: string;
  logoSrc?: string | null;
  companyName?: string | null;
  qrValue?: string;
  onPrint: () => void;
  onClose: () => void;
  children: ReactNode;
  afterContent?: ReactNode;
}

export function DocumentPreviewModal({
  isOpen,
  title,
  documentTitle,
  fileName,
  logoSrc,
  companyName,
  qrValue = COMPANY_URL,
  onPrint,
  onClose,
  children,
  afterContent,
}: DocumentPreviewModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  // Warm html2canvas-pro + jsPDF while the user reads the preview, so the first
  // Print click isn't spent downloading them.
  useEffect(() => {
    if (isOpen) preloadDocumentPdfDeps();
  }, [isOpen]);

  const handlePrint = async () => {
    const el = document.getElementById('irisk-print-root');
    if (!el || isPrinting) return;
    const printTitle = fileName ?? documentTitle;

    // Open the tab synchronously so popup blockers treat it as click-driven.
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.title = printTitle;
      printWindow.document.body.innerHTML =
        '<p style="font-family: sans-serif; padding: 24px; color: #6b7280;">Preparing document…</p>';
    }

    setIsPrinting(true);
    const restore = stagePrintRoot(el);
    try {
      const blob = await renderPrintRootToPdf(el, printTitle);
      if (printWindow && !printWindow.closed) {
        await openPdfPreview(printWindow, blob, printTitle);
      }
    } catch (error) {
      console.error('Failed to generate print PDF', error);
      if (printWindow && !printWindow.closed) {
        printWindow.document.body.innerHTML =
          '<p style="font-family: sans-serif; padding: 24px; color: #b91c1c;">Could not generate the document. Please try again.</p>';
      }
    } finally {
      restore();
      setIsPrinting(false);
      // Deferred until the capture is done: several callers use onPrint to close
      // this modal, which unmounts the portaled #irisk-print-root. Firing it any
      // earlier races html2canvas's async clone-and-capture of that same element,
      // causing "Unable to find element in cloned iframe".
      onPrint();
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        width="sm:w-[40vw] sm:max-w-[40vw]"
        height="sm:h-[90vh] sm:max-h-[90vh]"
        fullScreenMobile
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Close Preview
            </Button>
            <Button onClick={handlePrint} isLoading={isPrinting} loadingText="Preparing…">
              Print
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 items-center pb-2 border-b border-gray-100">
            {logoSrc ? (
              <Image
                src={logoSrc}
                alt={companyName ?? 'Company logo'}
                width={120}
                height={60}
                className="object-contain justify-self-start max-h-15"
                unoptimized
              />
            ) : (
              <CompanyLogo
                width={120}
                height={60}
                className="object-contain justify-self-start"
                priority
              />
            )}
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide text-center">
              {documentTitle}
            </h2>
            <div className="flex flex-col items-center gap-1 justify-self-end">
              <QRCode value={qrValue} size={56} />
            </div>
          </div>

          <div className="flex justify-center pt-6">
            <div className="w-full max-w-lg">{children}</div>
          </div>
        </div>
      </Modal>

      {isOpen && (
        <DocumentPrintLayout documentTitle={documentTitle} afterContent={afterContent}>
          {children}
        </DocumentPrintLayout>
      )}
    </>
  );
}
