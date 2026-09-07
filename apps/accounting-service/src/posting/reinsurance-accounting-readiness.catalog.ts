import {
  AccountingSettlementMethod,
  SubledgerType,
} from '../../prisma/generated/client';

export type ReinsuranceReadinessBlockerCode =
  | 'ACCOUNTING_INTEGRATION_DISABLED'
  | 'POSTING_RULE_MISSING'
  | 'POSTING_RULE_INACTIVE'
  | 'POSTING_RULE_INVALID'
  | 'CONTROL_ACCOUNT_MISSING'
  | 'CONTROL_ACCOUNT_INACTIVE'
  | 'CONTROL_ACCOUNT_NOT_POSTABLE'
  | 'CURRENCY_MISSING'
  | 'CURRENCY_INACTIVE'
  | 'FISCAL_PERIOD_MISSING'
  | 'FISCAL_PERIOD_CLOSED'
  | 'CASH_ACCOUNT_REQUIRED'
  | 'CASH_ACCOUNT_INVALID';

export type ReinsuranceAccountingEventKind = 'CASH' | 'NON_CASH';

export type ReinsuranceControlDimension =
  | 'CEDANT_PREMIUM_AR'
  | 'CEDANT_CLAIMS_AP'
  | 'REINSURER_PREMIUM_AP'
  | 'REINSURER_CLAIMS_AR';

export type ReinsuranceAccountingEventReadinessDefinition = {
  eventType: string;
  kind: ReinsuranceAccountingEventKind;
  requiredSubledgerType: SubledgerType;
  controlDimension: ReinsuranceControlDimension;
  reversalDependsOnOriginalRecognition: boolean;
};

export const REINSURANCE_ACCOUNTING_EVENT_DEFINITIONS = [
  {
    eventType: 'DEBIT_NOTE_ISSUED',
    kind: 'NON_CASH',
    requiredSubledgerType: SubledgerType.CEDANT,
    controlDimension: 'CEDANT_PREMIUM_AR',
    reversalDependsOnOriginalRecognition: false,
  },
  {
    eventType: 'CREDIT_NOTE_ISSUED',
    kind: 'NON_CASH',
    requiredSubledgerType: SubledgerType.REINSURER,
    controlDimension: 'REINSURER_PREMIUM_AP',
    reversalDependsOnOriginalRecognition: false,
  },
  {
    eventType: 'ENDORSEMENT_DEBIT_NOTE_ISSUED',
    kind: 'NON_CASH',
    requiredSubledgerType: SubledgerType.CEDANT,
    controlDimension: 'CEDANT_PREMIUM_AR',
    reversalDependsOnOriginalRecognition: false,
  },
  {
    eventType: 'ENDORSEMENT_CREDIT_NOTE_ISSUED',
    kind: 'NON_CASH',
    requiredSubledgerType: SubledgerType.REINSURER,
    controlDimension: 'REINSURER_PREMIUM_AP',
    reversalDependsOnOriginalRecognition: false,
  },
  {
    eventType: 'PREMIUM_PAYMENT_RECEIVED',
    kind: 'CASH',
    requiredSubledgerType: SubledgerType.CEDANT,
    controlDimension: 'CEDANT_PREMIUM_AR',
    reversalDependsOnOriginalRecognition: false,
  },
  {
    eventType: 'PAYMENT_REVERSED',
    kind: 'CASH',
    requiredSubledgerType: SubledgerType.CEDANT,
    controlDimension: 'CEDANT_PREMIUM_AR',
    reversalDependsOnOriginalRecognition: true,
  },
  {
    eventType: 'REINSURER_DISBURSEMENT_RECORDED',
    kind: 'CASH',
    requiredSubledgerType: SubledgerType.REINSURER,
    controlDimension: 'REINSURER_PREMIUM_AP',
    reversalDependsOnOriginalRecognition: false,
  },
  {
    eventType: 'REINSURER_DISBURSEMENT_REVERSED',
    kind: 'CASH',
    requiredSubledgerType: SubledgerType.REINSURER,
    controlDimension: 'REINSURER_PREMIUM_AP',
    reversalDependsOnOriginalRecognition: true,
  },
  {
    eventType: 'CLAIM_PAYABLE_APPROVED',
    kind: 'NON_CASH',
    requiredSubledgerType: SubledgerType.CEDANT,
    controlDimension: 'CEDANT_CLAIMS_AP',
    reversalDependsOnOriginalRecognition: false,
  },
  {
    eventType: 'CLAIM_RECOVERY_APPROVED',
    kind: 'NON_CASH',
    requiredSubledgerType: SubledgerType.REINSURER,
    controlDimension: 'REINSURER_CLAIMS_AR',
    reversalDependsOnOriginalRecognition: false,
  },
  {
    eventType: 'CLAIM_RECOVERY_RECEIVED',
    kind: 'CASH',
    requiredSubledgerType: SubledgerType.REINSURER,
    controlDimension: 'REINSURER_CLAIMS_AR',
    reversalDependsOnOriginalRecognition: false,
  },
  {
    eventType: 'CLAIM_RECOVERY_RECEIPT_REVERSED',
    kind: 'CASH',
    requiredSubledgerType: SubledgerType.REINSURER,
    controlDimension: 'REINSURER_CLAIMS_AR',
    reversalDependsOnOriginalRecognition: true,
  },
  {
    eventType: 'CLAIM_CEDANT_SETTLEMENT_PAID',
    kind: 'CASH',
    requiredSubledgerType: SubledgerType.CEDANT,
    controlDimension: 'CEDANT_CLAIMS_AP',
    reversalDependsOnOriginalRecognition: false,
  },
  {
    eventType: 'CLAIM_CEDANT_SETTLEMENT_REVERSED',
    kind: 'CASH',
    requiredSubledgerType: SubledgerType.CEDANT,
    controlDimension: 'CEDANT_CLAIMS_AP',
    reversalDependsOnOriginalRecognition: true,
  },
] as const satisfies readonly ReinsuranceAccountingEventReadinessDefinition[];

export const REINSURANCE_ACCOUNTING_EVENT_BY_TYPE = new Map<
  string,
  ReinsuranceAccountingEventReadinessDefinition
>(
  REINSURANCE_ACCOUNTING_EVENT_DEFINITIONS.map((definition) => [
    definition.eventType,
    definition,
  ]),
);

export function isCashbookSettlementMethod(
  settlementMethod?: string | null,
): boolean {
  const method = settlementMethod?.trim().toUpperCase();
  if (!method) return true;
  const cashbookMethods: string[] = [
    AccountingSettlementMethod.BANK_TRANSFER,
    AccountingSettlementMethod.CHEQUE,
    AccountingSettlementMethod.CASH,
    AccountingSettlementMethod.MOBILE_MONEY,
  ];
  return cashbookMethods.includes(method);
}
