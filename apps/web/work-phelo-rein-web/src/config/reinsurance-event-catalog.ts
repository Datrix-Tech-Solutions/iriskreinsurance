import type { PostingRuleDirection, PostingRuleSubledgerType } from '@/types/accounting';

// ---------------------------------------------------------------------------
// Reinsurance source event catalog
//
// Single source of truth for the Reinsurance→Accounting posting-inbox event
// types (see accounting-service/src/posting/reinsurance-accounting-readiness.catalog.ts
// + the AR/AP matrix in accounting-service/README.md, and the exact payload
// paths reinsurance-financial-event-publisher.service.ts sends for each event
// — active Reinsurance Accounting events currently nest counterparties under
// `counterparty.id`).
//
// Used both to drive the guided "New Posting Rule" flow (pre-filling the
// correct DR/CR direction, subledger tag, external ref path, and amount path)
// and to render a plain-English label anywhere a raw `sourceEventType` code
// (e.g. "PREMIUM_PAYMENT_RECEIVED") would otherwise reach the UI verbatim —
// the posting inbox table, posting rule tables/panels, and the auto-generated
// journal descriptions shown in the GL account ledger.
// ---------------------------------------------------------------------------

export type EventTemplateLine = {
  direction: PostingRuleDirection;
  roleLabel: string;
  subledgerType?: PostingRuleSubledgerType;
  subledgerExternalRefSource?: string;
  amountSource: string;
};

export type EventTemplate = {
  eventType: string;
  label: string;
  description: string;
  controlDimensionLabel: string;
  lines: [EventTemplateLine, EventTemplateLine];
};

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    eventType: 'DEBIT_NOTE_ISSUED',
    label: 'Debit note issued',
    description: 'Cedant owes premium — a debit note has been issued.',
    controlDimensionLabel: 'Cedant Premium Receivable (AR)',
    lines: [
      {
        direction: 'DR',
        roleLabel: 'Premium Receivable',
        subledgerType: 'CEDANT',
        subledgerExternalRefSource: 'counterparty.id',
        amountSource: 'amounts.netPremium',
      },
      {
        direction: 'CR',
        roleLabel: 'Premium Income / Clearing',
        amountSource: 'amounts.netPremium',
      },
    ],
  },
  {
    eventType: 'CREDIT_NOTE_ISSUED',
    label: 'Credit note issued',
    description: 'Broker owes a premium share to the reinsurer — a credit note has been issued.',
    controlDimensionLabel: 'Reinsurer Premium Payable (AP)',
    lines: [
      {
        direction: 'DR',
        roleLabel: 'Premium Expense / Clearing',
        amountSource: 'amounts.creditMagnitude',
      },
      {
        direction: 'CR',
        roleLabel: 'Premium Payable',
        subledgerType: 'REINSURER',
        subledgerExternalRefSource: 'counterparty.id',
        amountSource: 'amounts.creditMagnitude',
      },
    ],
  },
  {
    eventType: 'ENDORSEMENT_DEBIT_NOTE_ISSUED',
    label: 'Endorsement debit note issued',
    description: 'Additional premium is due from the cedant after an endorsement.',
    controlDimensionLabel: 'Cedant Premium Receivable (AR)',
    lines: [
      {
        direction: 'DR',
        roleLabel: 'Premium Receivable',
        subledgerType: 'CEDANT',
        subledgerExternalRefSource: 'counterparty.id',
        amountSource: 'amounts.adjustmentMagnitude',
      },
      {
        direction: 'CR',
        roleLabel: 'Premium Income / Clearing',
        amountSource: 'amounts.adjustmentMagnitude',
      },
    ],
  },
  {
    eventType: 'ENDORSEMENT_CREDIT_NOTE_ISSUED',
    label: 'Endorsement credit note issued',
    description:
      'A return premium or payable adjustment is due to the reinsurer after an endorsement.',
    controlDimensionLabel: 'Reinsurer Premium Payable (AP)',
    lines: [
      {
        direction: 'DR',
        roleLabel: 'Premium Expense / Clearing',
        amountSource: 'amounts.adjustmentMagnitude',
      },
      {
        direction: 'CR',
        roleLabel: 'Premium Payable',
        subledgerType: 'REINSURER',
        subledgerExternalRefSource: 'counterparty.id',
        amountSource: 'amounts.adjustmentMagnitude',
      },
    ],
  },
  {
    eventType: 'PREMIUM_PAYMENT_RECEIVED',
    label: 'Premium Receivable',
    description: "The cedant's premium payment clears their receivable.",
    controlDimensionLabel: 'Cedant Premium Receivable (AR)',
    lines: [
      { direction: 'DR', roleLabel: 'Bank / Cash', amountSource: 'amounts.paymentAmount' },
      {
        direction: 'CR',
        roleLabel: 'Premium Receivable',
        subledgerType: 'CEDANT',
        subledgerExternalRefSource: 'counterparty.id',
        amountSource: 'amounts.paymentAmount',
      },
    ],
  },
  {
    eventType: 'PAYMENT_REVERSED',
    label: 'Premium payment reversed',
    description: 'A cedant premium receipt is being reversed.',
    controlDimensionLabel: 'Cedant Premium Receivable (AR)',
    lines: [
      {
        direction: 'DR',
        roleLabel: 'Premium Receivable',
        subledgerType: 'CEDANT',
        subledgerExternalRefSource: 'counterparty.id',
        amountSource: 'amounts.paymentAmount',
      },
      { direction: 'CR', roleLabel: 'Bank / Cash', amountSource: 'amounts.paymentAmount' },
    ],
  },
  {
    eventType: 'REINSURER_DISBURSEMENT_RECORDED',
    label: 'Premium payable',
    description: 'A confirmed payment to the reinsurer clears what is owed to them.',
    controlDimensionLabel: 'Reinsurer Premium Payable (AP)',
    lines: [
      {
        direction: 'DR',
        roleLabel: 'Reinsurer Premium Payable',
        subledgerType: 'REINSURER',
        subledgerExternalRefSource: 'counterparty.id',
        amountSource: 'amounts.allocatedAmount',
      },
      { direction: 'CR', roleLabel: 'Bank / Cash', amountSource: 'amounts.allocatedAmount' },
    ],
  },
  {
    eventType: 'REINSURER_DISBURSEMENT_REVERSED',
    label: 'Reinsurer disbursement reversed',
    description: 'A reinsurer disbursement is being reversed.',
    controlDimensionLabel: 'Reinsurer Premium Payable (AP)',
    lines: [
      { direction: 'DR', roleLabel: 'Bank / Cash', amountSource: 'amounts.allocatedAmount' },
      {
        direction: 'CR',
        roleLabel: 'Reinsurer Premium Payable',
        subledgerType: 'REINSURER',
        subledgerExternalRefSource: 'counterparty.id',
        amountSource: 'amounts.allocatedAmount',
      },
    ],
  },
];

export const EVENT_TEMPLATE_BY_TYPE = new Map(EVENT_TEMPLATES.map((t) => [t.eventType, t]));

/**
 * Plain-English label for a raw `sourceEventType` code (e.g.
 * "PREMIUM_PAYMENT_RECEIVED" -> "Premium payment received"). Falls back to a
 * humanized version of the raw code for event types outside the known
 * Reinsurance catalog (e.g. once other modules start publishing source
 * events), so unrecognized codes still render as words rather than a raw
 * constant.
 */
export function getSourceEventLabel(eventType: string | null | undefined): string {
  if (!eventType) return '—';
  return EVENT_TEMPLATE_BY_TYPE.get(eventType)?.label ?? eventType.replaceAll('_', ' ');
}

/**
 * Source-event postings carry an auto-generated "EVENT_TYPE - sourceRecordId"
 * description (see accounting-service/src/posting/source-events.service.ts) —
 * no user ever types this. Swap the raw event code for its plain-English
 * label and drop the trailing source-record id — callers that want the raw
 * string for traceability (e.g. a hover tooltip) still have the original
 * value they passed in. Manually entered descriptions (anything whose
 * leading token isn't a known event type) pass through unchanged.
 *
 * Used everywhere an auto-posted journal/ledger description reaches the UI:
 * the GL account ledger, the General Ledger report, and journal entries
 * (list + detail).
 */
export function formatSourceEventDescription(raw: string | null | undefined): string {
  if (!raw) return '—';
  const match = raw.match(/^([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*) - .+$/);
  const eventType = match?.[1];
  return eventType && EVENT_TEMPLATE_BY_TYPE.has(eventType) ? getSourceEventLabel(eventType) : raw;
}
