'use client';

import { useRiskTypes } from '@/hooks';
import type { Facultative } from '@/types/reinsurance';
import { buildDocumentFileName } from './documentFileName';
import { displayPolicyNumber } from './policyNumber';

interface UseDocumentFileNameArgs {
  /** e.g. "Debit Note", "Offer Slip", "Closings". */
  documentName: string;
  /** Source for policy number, risk type and insured when not overridden. */
  placement?: Pick<Facultative, 'policyNumber' | 'riskTypeId' | 'title'> | null;
  /** Overrides `placement.policyNumber` (e.g. an endorsement's policy number). */
  policyNumber?: string | null;
  /** Overrides `placement.title`. */
  insured?: string | null;
  /** Rendered as "to <recipientName>" at the end. */
  recipientName?: string | null;
}

/**
 * Builds the standard document filename
 * `documentname-policynumber-risktype-insured-to recipientname`, resolving the
 * risk type name from `placement.riskTypeId`.
 */
export function useDocumentFileName({
  documentName,
  placement,
  policyNumber,
  insured,
  recipientName,
}: UseDocumentFileNameArgs): string {
  const { data: riskTypes = [] } = useRiskTypes();
  const riskTypeName = placement?.riskTypeId
    ? (riskTypes.find((rt) => rt.id === placement.riskTypeId)?.name ?? null)
    : null;

  return buildDocumentFileName(
    documentName,
    displayPolicyNumber(policyNumber ?? placement?.policyNumber ?? null),
    riskTypeName,
    insured ?? placement?.title ?? null,
    recipientName ? `to ${recipientName}` : null,
  );
}
