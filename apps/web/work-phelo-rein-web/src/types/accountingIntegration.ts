export type AccountingSourceModule = 'REINSURANCE' | (string & {});
export type AccountingConfirmationDirection = 'INBOUND' | 'OUTBOUND';
export type AccountingConfirmationAction = 'CONFIRM_BANK_PAYMENT' | 'CONFIRM_BANK_RECEIPT';
export type SettlementMethod =
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CASH'
  | 'MOBILE_MONEY'
  | 'INTERNAL_OFFSET'
  | 'JOURNAL'
  | 'OTHER';

export interface AccountingConfirmationBusinessSnapshot {
  placementId?: string | null;
  placementReference?: string | null;
  policyNumber?: string | null;
  placementTitle?: string | null;
  endorsementReference?: string | null;
  closingReference?: string | null;
  claimId?: string | null;
  claimNumber?: string | null;
  allocationId?: string | null;
  cashCallId?: string | null;
  recoveryApprovalId?: string | null;
  payableApprovalId?: string | null;
  counterpartyName?: string | null;
  cedantName?: string | null;
  reinsurerName?: string | null;
  operationalPaymentAmount?: string | number | null;
  operationalPaymentCurrency?: string | null;
  settlementMethod?: SettlementMethod | null;
  settlementCurrency?: string | null;
  obligationCurrency?: string | null;
  cedantPremiumPaymentCurrency?: string | null;
  cedantPaymentFxRate?: string | number | null;
  nicLevyAmount?: string | number | null;
  contractualWithholdingTaxAmount?: string | number | null;
  contractualWithholdingTaxRate?: string | number | null;
  creditNoteReference?: string | null;
  operationalPaymentDate?: string | null;
  paymentReference?: string | null;
}

export interface AccountingBankConfirmationWorkItem {
  id: string;
  sourceModule: AccountingSourceModule;
  sourceRecordId: string;
  sourceParentId: string;
  sourceReference: string;
  transactionType: string;
  sourceRecordType?: string;
  action?: AccountingConfirmationAction;
  direction: AccountingConfirmationDirection;
  counterpartyId: string;
  sourceDescription: string;
  sourceDetailUrl: string | null;
  counterpartyName: string;
  counterpartyType: string;
  amount: string | number;
  currency: string;
  operationalDate: string;
  operationalReference: string | null;
  settlementReference: string | null;
  operationalStatus: string;
  confirmationStatus: string;
  availableConfirmationActions: AccountingConfirmationAction[];
  businessSnapshot?: AccountingConfirmationBusinessSnapshot;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ConfirmBankPaymentPayload {
  bankConfirmedAt: string;
  bankReference?: string;
  accountingCashAccountId?: string;
  settlementMethod?: SettlementMethod;
  settlementCurrency?: string;
  confirmedExchangeRate?: number;
  agreedExchangeRate?: number;
  bankChargeAmount?: number;
  notes?: string;
}

export interface ReinsuranceAccountingReadinessBlocker {
  code: string;
  message: string;
}

export interface ReinsuranceAccountingEventReadiness {
  eventType: string;
  ready: boolean;
  kind: string | null;
  controlDimension: string | null;
  requiredSubledgerType: string | null;
  reversalDependsOnOriginalRecognition: boolean;
  blockers: ReinsuranceAccountingReadinessBlocker[];
}

export interface ReinsuranceAccountingPostingReadiness {
  ready: boolean;
  checkedAt: string;
  eventResults: ReinsuranceAccountingEventReadiness[];
  message?: string;
}

export type ReinsuranceAccountingReadinessGroupKey =
  | 'premiumAccounting'
  | 'cashConfirmation';

export interface ReinsuranceAccountingReadinessGroup {
  ready: boolean;
  events: ReinsuranceAccountingEventReadiness[];
}

export interface ReinsuranceAccountingIntegrationStatus {
  accountingEnabled: boolean;
  reinsuranceEnabled: boolean;
  integrationEnabled: boolean;
  integrationActive: boolean;
  integrationConfigured: boolean;
  baseUrlConfigured: boolean;
  serviceAuthSecretConfigured: boolean;
  sourceEventsActive: boolean;
  activeSourceEvents: string[];
  postingReadiness: ReinsuranceAccountingPostingReadiness | null;
  readinessGroups: Record<
    ReinsuranceAccountingReadinessGroupKey,
    ReinsuranceAccountingReadinessGroup
  > | null;
  readinessMode: string;
  message: string;
}
