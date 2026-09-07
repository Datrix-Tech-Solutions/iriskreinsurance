'use client';

import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { useDocumentFileName } from '@/lib/reinsurance/useDocumentFileName';
import { DocumentPreviewShell } from '@/components/molecules/documents/DocumentPreviewShell';
import {
  PaymentReceiptContent,
  type PaymentReceiptContentProps,
} from '@/components/molecules/documents/content/PaymentReceiptContent';
import { DisbursementAdviceContent } from '@/components/molecules/documents/content/DisbursementAdviceContent';

interface PaymentReceiptModalProps extends PaymentReceiptContentProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Content-only preview opened from the payment history. Reinsurer disbursements
 * print the closing-style disbursement advice; every other payment type keeps
 * the plain payment receipt.
 */
export function PaymentReceiptModal({
  isOpen,
  onClose,
  receiptNo,
  ...content
}: PaymentReceiptModalProps) {
  const isDisbursement = content.payment.type === 'REINSURER_DISBURSEMENT';
  const label = isDisbursement ? 'Disbursement Advice' : 'Payment Receipt';
  const fileName = useDocumentFileName({
    documentName: label,
    placement: content.placement,
    recipientName: content.payment.counterparty?.name ?? null,
  });

  return (
    <DocumentPreviewShell
      isOpen={isOpen}
      title={`${label} — ${displayPolicyNumber(content.placement.policyNumber)}`}
      fileName={fileName}
      printRootId="payment-receipt-print-root"
      onClose={onClose}
    >
      {isDisbursement ? (
        <DisbursementAdviceContent {...content} />
      ) : (
        <PaymentReceiptContent {...content} receiptNo={receiptNo} />
      )}
    </DocumentPreviewShell>
  );
}
