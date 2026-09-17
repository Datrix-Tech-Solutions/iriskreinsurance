const REINSURANCE_EVENT_GUIDANCE: Record<
  string,
  { amountSources: string[]; subledgerReferenceSources: string[] }
> = {
  DEBIT_NOTE_ISSUED: {
    amountSources: ['amounts.netPremium'],
    subledgerReferenceSources: ['counterparty.id'],
  },
  CREDIT_NOTE_ISSUED: {
    amountSources: ['amounts.creditMagnitude'],
    subledgerReferenceSources: ['counterparty.id'],
  },
  ENDORSEMENT_DEBIT_NOTE_ISSUED: {
    amountSources: ['amounts.adjustmentMagnitude'],
    subledgerReferenceSources: ['counterparty.id'],
  },
  ENDORSEMENT_CREDIT_NOTE_ISSUED: {
    amountSources: ['amounts.returnPremiumMagnitude'],
    subledgerReferenceSources: ['counterparty.id'],
  },
  PREMIUM_PAYMENT_RECEIVED: {
    amountSources: ['amounts.paymentAmount'],
    subledgerReferenceSources: ['counterparty.id'],
  },
  PAYMENT_REVERSED: {
    amountSources: ['amounts.paymentAmount'],
    subledgerReferenceSources: ['counterparty.id'],
  },
  REINSURER_DISBURSEMENT_RECORDED: {
    amountSources: ['amounts.paymentAmount'],
    subledgerReferenceSources: ['counterparty.id'],
  },
  REINSURER_DISBURSEMENT_REVERSED: {
    amountSources: ['amounts.allocatedAmount'],
    subledgerReferenceSources: ['counterparty.id'],
  },
};

const ALL_REINSURANCE_AMOUNT_SOURCES = Array.from(
  new Set(Object.values(REINSURANCE_EVENT_GUIDANCE).flatMap(({ amountSources }) => amountSources)),
);

const ALL_REINSURANCE_SUBLEDGER_REFERENCE_SOURCES = Array.from(
  new Set(
    Object.values(REINSURANCE_EVENT_GUIDANCE).flatMap(
      ({ subledgerReferenceSources }) => subledgerReferenceSources,
    ),
  ),
);

export function getPostingRulePathGuidance(sourceModule?: string, sourceEventType?: string) {
  const isReinsurance = sourceModule?.trim().toUpperCase() === 'REINSURANCE';
  const eventType = sourceEventType?.trim().toUpperCase();
  const eventGuidance = eventType ? REINSURANCE_EVENT_GUIDANCE[eventType] : undefined;

  return {
    amountSources:
      eventGuidance?.amountSources ?? (isReinsurance ? ALL_REINSURANCE_AMOUNT_SOURCES : []),
    currencySources: ['currency', 'settlement.currency'],
    subledgerReferenceSources:
      eventGuidance?.subledgerReferenceSources ??
      (isReinsurance ? ALL_REINSURANCE_SUBLEDGER_REFERENCE_SOURCES : []),
  };
}
