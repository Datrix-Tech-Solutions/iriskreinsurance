/* ── Reinsurance domain types ── */

/* ── Unified Counterparty (API response shape) ── */
export type CounterpartyType = 'CEDANT' | 'REINSURER' | 'BROKER';

export interface CounterpartyContact {
  id: string;
  fullName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface CounterpartyAddress {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  isPrimary: boolean;
}

export interface Counterparty {
  id: string;
  tenantId: string;
  type: CounterpartyType;
  name: string;
  normalizedName: string;
  registrationNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  brokerageFee: number | null;
  contacts: CounterpartyContact[];
  addresses: CounterpartyAddress[];
  createdByUserId: string;
  updatedByUserId: string;
  archivedByUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Backward-compat aliases used by existing table components */
export type Cedant = Counterparty;
export type Reinsurer = Counterparty;
export type Broker = Counterparty;

/* ── Paginated list response ── */
export interface PaginatedCounterparties {
  items: Counterparty[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/* ── Shared address form values ── */
export interface AddressFormValues {
  country: string; // 'Ghana' | 'Africa' | 'Europe' | 'Asia' | 'Rest of the World'
  state: string; // Ghana region — only relevant when country === 'Ghana'
  streetName: string; // Ghana only
  city: string; // only relevant when country === 'Ghana'
}

export const ADDRESS_FORM_DEFAULTS: AddressFormValues = {
  country: '',
  state: '',
  streetName: '',
  city: '',
};

/* ── Additional contact person (used in all three counterparty forms) ── */
export interface ContactPersonFormValues {
  fullName: string;
  email: string;
  phone: string;
}

export const CONTACT_PERSON_DEFAULTS: ContactPersonFormValues = {
  fullName: '',
  email: '',
  phone: '',
};

/* ── Cedant form ── */
export interface CedantFormValues {
  name: string;
  email: string;
  phone: string;
  contacts: ContactPersonFormValues[];
  address: AddressFormValues;
}

export const CEDANT_FORM_DEFAULTS: CedantFormValues = {
  name: '',
  email: '',
  phone: '',
  contacts: [],
  address: ADDRESS_FORM_DEFAULTS,
};

/* ── Reinsurer form ── */
export interface ReinsurerFormValues {
  name: string;
  email: string;
  phone: string;
  brokerageFee: number | '';
  contacts: ContactPersonFormValues[];
  address: AddressFormValues;
}

export const REINSURER_FORM_DEFAULTS: ReinsurerFormValues = {
  name: '',
  email: '',
  phone: '',
  brokerageFee: '',
  contacts: [],
  address: ADDRESS_FORM_DEFAULTS,
};

/* ── Broker form ── */
export interface BrokerFormValues {
  name: string;
  email: string;
  phone: string;
  contacts: ContactPersonFormValues[];
  address: AddressFormValues;
}

export const BROKER_FORM_DEFAULTS: BrokerFormValues = {
  name: '',
  email: '',
  phone: '',
  contacts: [],
  address: ADDRESS_FORM_DEFAULTS,
};

/* ── API payload types ── */

export interface CounterpartyContactPayload {
  fullName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface CounterpartyAddressPayload {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  isPrimary?: boolean;
}

export interface CreateCounterpartyPayload {
  type: CounterpartyType;
  name: string;
  registrationNumber?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
  brokerageFee?: number;
  contacts?: CounterpartyContactPayload[];
  addresses?: CounterpartyAddressPayload[];
}

export type UpdateCounterpartyPayload = Partial<Omit<CreateCounterpartyPayload, 'type'>>;

export interface CreateRiskClassPayload {
  name: string;
  description?: string;
  isActive?: boolean;
  displayOrder?: number;
}
export type UpdateRiskClassPayload = Partial<CreateRiskClassPayload>;

export type RiskTypeFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX' | 'TEXTAREA';
export type RiskTypeFieldSection = 'BUSINESS_DETAILS' | 'OFFER_DETAILS';

export interface RiskTypeCustomField {
  label: string;
  value: string;
}

export interface CreateRiskTypePayload {
  name: string;
  riskClassId: string;
  description?: string;
  isActive?: boolean;
  displayOrder?: number;
}
export type UpdateRiskTypePayload = Partial<Omit<CreateRiskTypePayload, 'riskClassId'>>;

export interface CreateRiskTypeFieldPayload {
  section: RiskTypeFieldSection;
  fieldKey: string;
  label: string;
  fieldType: RiskTypeFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  displayOrder?: number;
}

export interface CreateCurrencyPayload {
  name: string;
  isoCode: string;
  symbol?: string;
  exchangeRateToBase?: number;
  isBaseCurrency?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}
export type UpdateCurrencyPayload = Partial<Omit<CreateCurrencyPayload, 'isoCode'>>;

/* ── Currency ── */
export interface Currency {
  id: string;
  tenantId: string;
  isoCode: string;
  name: string;
  symbol: string | null;
  exchangeRateToBase: string | null;
  isBaseCurrency: boolean;
  isActive: boolean;
  displayOrder: number;
  createdByUserId: string;
  updatedByUserId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrencyFormValues {
  name: string;
  isoCode: string;
  symbol: string;
}

export const CURRENCY_FORM_DEFAULTS: CurrencyFormValues = {
  name: '',
  isoCode: '',
  symbol: '',
};

/* ── Risk Type ── */
export interface RiskTypeField {
  id: string;
  tenantId: string;
  riskTypeId: string;
  section: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  required: boolean;
  options: string[] | null;
  validationRules: Record<string, unknown> | null;
  placeholder: string | null;
  helpText: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RiskType {
  id: string;
  tenantId: string;
  riskClassId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  fields: RiskTypeField[];
  createdByUserId: string;
  updatedByUserId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiskTypeFormValues {
  name: string;
  riskClassId: string;
  customFields: RiskTypeCustomField[];
}

export const RISK_TYPE_FORM_DEFAULTS: RiskTypeFormValues = {
  name: '',
  riskClassId: '',
  customFields: [],
};

/* ── Risk Class ── */
export interface RiskClass {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  riskTypes: RiskType[];
  createdByUserId: string;
  updatedByUserId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiskClassFormValues {
  name: string;
  description: string;
}

export const RISK_CLASS_FORM_DEFAULTS: RiskClassFormValues = {
  name: '',
  description: '',
};

/* ── Facultative ── */
export const FACULTATIVE_STATUSES = [
  'DRAFT',
  'MARKETING',
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
] as const;
export type FacultativeStatus = (typeof FACULTATIVE_STATUSES)[number];

export const PLACEMENT_DISPLAY_STATUSES = ['Open', 'Closed'] as const;
export type PlacementDisplayStatus = (typeof PLACEMENT_DISPLAY_STATUSES)[number];

export function toDisplayStatus(status: FacultativeStatus): PlacementDisplayStatus {
  if (status === 'CLOSED' || status === 'DECLINED' || status === 'CANCELLED') return 'Closed';
  return 'Open';
}

export function toStatusLabel(status: FacultativeStatus): string {
  if (status === 'PARTIALLY_PLACED') return 'Partially Placed';
  if (status === 'PLACED') return 'Placed';
  if (status === 'CLOSING') return 'Partially Closed';
  if (status === 'MARKETING') return 'On Market';
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

export type PlacementParticipantRole = 'BROKER' | 'REINSURER' | 'LEAD_REINSURER' | 'CO_REINSURER';
export type PlacementParticipantStatus =
  | 'INVITED'
  | 'OFFER_SENT'
  | 'QUOTED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CLOSED';

export interface PlacementParticipant {
  id: string;
  counterpartyId: string;
  role: PlacementParticipantRole;
  status: PlacementParticipantStatus;
  sharePercent: string | null;
  signedLinePercent: string | null;
  brokerageFee: string | null;
  notes: string | null;
  createdAt?: string;
  counterparty: { id: string; name: string };
}

export interface PlacementParticipantPayload {
  counterpartyId: string;
  role: PlacementParticipantRole;
  status?: PlacementParticipantStatus;
  sharePercent?: number;
  signedLinePercent?: number;
  brokerageFee?: number;
  notes?: string;
}

export interface UpdateParticipantPayload {
  sharePercent?: number;
  signedLinePercent?: number;
  brokerageFee?: number;
  notes?: string;
}

export interface UpdateParticipantStatusPayload {
  status: PlacementParticipantStatus;
  note?: string;
}

export interface Facultative {
  insuranceCompany: string | null;
  policyNumber: string | null;
  id: string;
  reference: string;
  title: string;
  classOfBusiness: string | null;
  riskTypeId: string | null;
  cedant: { id: string; name: string };
  cedantId: string;
  cedantName: string;
  businessDetails: Record<string, unknown> | null;
  offerDetails: Record<string, unknown> | null;
  description: string | null;
  sumInsured: number | null;
  rate: number | null;
  commission: number | null;
  facultativeOffer: number | null;
  premium: number | null;
  currency: string | null;
  inceptionDate: string | null;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
  archivedByUserId: string | null;
  archiveReason: string | null;
  archivedAt: string | null;
  closeMode?: 'NORMAL' | 'FORCED' | string | null;
  forceClosed?: boolean;
  forceClosedAt?: string | null;
  forceClosedByUserId?: string | null;
  status: FacultativeStatus;
  participants: PlacementParticipant[];
  totalOfferedPercent: number;
  totalAcceptedPercent: number;
  remainingPercent: number;
}

/* ── Facultative API payloads ── */
export interface CreateFacultativePayload {
  cedantId: string;
  riskTypeId: string;
  reference: string;
  policyNumber?: string | null;
  title: string;
  description?: string;
  sumInsured: number;
  rate: number;
  premium: number;
  facultativeOffer: number;
  commission: number;
  currency: string;
  inceptionDate?: string;
  expiryDate?: string;
  businessDetails?: Record<string, unknown>;
  offerDetails?: Record<string, unknown>;
  participants?: PlacementParticipantPayload[];
}

export type UpdateFacultativePayload = Partial<Omit<CreateFacultativePayload, 'cedantId'>>;

/* ── Placement Endorsements ── */
export type PlacementEndorsementStatus =
  | 'DRAFT'
  | 'MARKETING'
  | 'PARTIALLY_ACCEPTED'
  | 'ACCEPTED'
  | 'CLOSING'
  | 'CLOSED'
  | 'DECLINED'
  | 'VOID';

export type PlacementEndorsementType =
  | 'SUM_INSURED_INCREASE'
  | 'SUM_INSURED_DECREASE'
  | 'PREMIUM_ADJUSTMENT'
  | 'COVERAGE_AMENDMENT'
  | 'POLICY_AMENDMENT'
  | 'PARTICIPANT_SHARE_CHANGE'
  | 'PARTICIPANT_ADDITION'
  | 'PARTICIPANT_REMOVAL'
  | 'CANCELLATION'
  | 'OTHER';

export const ENDORSEMENT_TYPE_LABELS: Record<PlacementEndorsementType, string> = {
  SUM_INSURED_INCREASE: 'Sum Insured Increase',
  SUM_INSURED_DECREASE: 'Sum Insured Decrease',
  PREMIUM_ADJUSTMENT: 'Premium Adjustment',
  COVERAGE_AMENDMENT: 'Coverage Amendment',
  POLICY_AMENDMENT: 'Policy Amendment',
  PARTICIPANT_SHARE_CHANGE: 'Participant Share Change',
  PARTICIPANT_ADDITION: 'Participant Addition',
  PARTICIPANT_REMOVAL: 'Participant Removal',
  CANCELLATION: 'Cancellation',
  OTHER: 'Other',
};

export const ENDORSEMENT_STATUS_LABELS: Record<PlacementEndorsementStatus, string> = {
  DRAFT: 'Draft',
  MARKETING: 'In Market',
  PARTIALLY_ACCEPTED: 'Partially Accepted',
  ACCEPTED: 'Accepted',
  CLOSING: 'Closing',
  CLOSED: 'Closed',
  DECLINED: 'Declined',
  VOID: 'Void',
};

export const ENDORSEMENT_STATUS_VARIANT: Record<
  PlacementEndorsementStatus,
  'neutral' | 'warning' | 'success' | 'danger'
> = {
  DRAFT: 'neutral',
  MARKETING: 'warning',
  PARTIALLY_ACCEPTED: 'warning',
  ACCEPTED: 'success',
  CLOSING: 'warning',
  CLOSED: 'success',
  DECLINED: 'danger',
  VOID: 'danger',
};

export const TERMINAL_ENDORSEMENT_STATUSES: PlacementEndorsementStatus[] = [
  'CLOSED',
  'DECLINED',
  'VOID',
];

/** True once an endorsement has been sent to market (past DRAFT) and hasn't been withdrawn. */
export function isEndorsementSentToMarket(status: PlacementEndorsementStatus): boolean {
  return status !== 'DRAFT' && status !== 'VOID' && status !== 'DECLINED';
}

export interface PlacementEndorsement {
  id: string;
  placementId: string;
  endorsementNumber: string;
  type: PlacementEndorsementType;
  impactType?: PlacementEndorsementImpactType;
  status: PlacementEndorsementStatus;
  effectiveDate: string;
  reason: string;
  description: string | null;
  changeSummary: Record<string, unknown> | null;
  originalSnapshot: Record<string, unknown>;
  proposedSnapshot: Record<string, unknown> | null;
  targetPercent?: string | number | null;
  createdByUserId: string;
  closedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PlacementEndorsementImpactType =
  | 'CAPACITY_INCREASE'
  | 'TERMS_ONLY'
  | 'DECREASE_OR_CANCELLATION'
  | 'ADMINISTRATIVE';

export type PlacementEndorsementPendingAction =
  | 'SEND_TO_MARKET'
  | 'ADD_CAPACITY'
  | 'ACCEPT_PARTICIPANTS'
  | 'CREATE_CLOSING'
  | 'ISSUE_CLOSING'
  | 'CONFIRM_CLOSING'
  | 'GENERATE_NOTES'
  | 'ISSUE_NOTES'
  | 'CLOSE_ENDORSEMENT';

export interface PlacementEndorsementSummary {
  id: string;
  placementId: string;
  endorsementNumber: string;
  type: PlacementEndorsementType;
  impactType: PlacementEndorsementImpactType;
  status: PlacementEndorsementStatus;
  targetPercent: number | null;
  acceptedPercent: number;
  placedPercent: number;
  remainingPercent: number | null;
  participants: {
    total: number;
    accepted: number;
    declined: number;
  };
  closings: {
    total: number;
    confirmed: number;
    draft: number;
    issued: number;
    void: number;
  };
  notes: {
    total: number;
    endorsementDebitNotes: number;
    endorsementCreditNotes: number;
    issued: number;
    draft: number;
    void: number;
  };
  pendingActions: PlacementEndorsementPendingAction[];
  canClose: boolean;
  closeBlockingReasons: Array<{
    code: string;
    message: string;
  }>;
  isComplete: boolean;
}

export interface EffectivePlacementView {
  viewAsOf: string;
  basePlacement: {
    id: string;
    reference: string;
    policyNumber: string | null;
    title: string;
    cedantId: string;
    currency: string | null;
    sumInsured: number | null;
    premium: number | null;
    rate: number | null;
    commissionPercent: number | null;
    brokeragePercent: number | null;
    facultativeOfferPercent: number | null;
  };
  effectiveTotals: {
    facultativeOfferPercent: number;
    originalFacultativeOfferPercent: number | null;
    acceptedEndorsementCapacityPercent: number;
    confirmedEndorsementCapacityPercent: number;
    remainingCapacityPercent: number;
    participantCount: number;
    sumInsured: number | null;
    premium: number | null;
    currency: string | null;
    rate: number | null;
    commissionPercent: number | null;
    brokeragePercent: number | null;
    grossPremium: number;
    commissionAmount: number;
    brokerageAmount: number;
    netPremium: number;
  };
  capacityBreakdown: {
    originalCapacityPercent: number | null;
    acceptedEndorsementCapacityPercent: number;
    confirmedEndorsementCapacityPercent: number;
    remainingCapacityPercent: number;
    effectiveTotalCapacityPercent: number;
  };
  effectiveTerms: {
    title: string;
    policyNumber: string | null;
    cedantId: string;
    riskTypeId: string | null;
    businessDetails: Record<string, unknown> | null;
    offerDetails: Record<string, unknown> | null;
    description: string | null;
    inceptionDate: string | null;
    expiryDate: string | null;
    currency: string | null;
    sumInsured: number | null;
    rate: number | null;
    premium: number | null;
    commissionPercent: number | null;
    brokeragePercent: number | null;
    facultativeOfferPercent: number | null;
  };
  effectiveParticipants: Array<{
    counterpartyId: string;
    counterparty: {
      id: string;
      type: string;
      name: string;
      registrationNumber: string | null;
    };
    signedLinePercent: number;
    participationType: 'ORIGINAL' | 'REVISED' | 'ADDED';
    grossPremium: number;
    commissionAmount: number;
    brokerageAmount: number;
    netPremium: number;
    sources: Array<{
      sourceType: 'PLACEMENT_CLOSING' | 'ENDORSEMENT_CLOSING';
      closingId: string;
      endorsementId?: string;
      participantId?: string;
      endorsementParticipantId?: string;
      originalParticipantId?: string | null;
      signedLinePercent: number;
    }>;
  }>;
  appliedEndorsements: Array<{
    id: string;
    endorsementNumber: string;
    type: PlacementEndorsementType;
    status: PlacementEndorsementStatus;
    effectiveDate: string;
    targetPercent: number | null;
    confirmedClosings: Array<{
      id: string;
      closingNumber: string;
      endorsementParticipantId: string;
      counterpartyId: string;
      signedLinePercent: number;
    }>;
  }>;
  pendingEndorsements: Array<{
    id: string;
    endorsementNumber: string;
    type: PlacementEndorsementType;
    status: PlacementEndorsementStatus;
    effectiveDate: string;
    targetPercent: number | null;
    confirmedClosingCount: number;
  }>;
  scheduledEndorsements: Array<{
    id: string;
    endorsementNumber: string;
    type: PlacementEndorsementType;
    status: PlacementEndorsementStatus;
    effectiveDate: string;
    targetPercent: number | null;
    confirmedClosingCount: number;
  }>;
  warnings: string[];
}

export type PlacementEndorsementParticipantStatus =
  | 'INVITED'
  | 'OFFER_SENT'
  | 'QUOTED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CLOSED';

export interface PlacementEndorsementParticipant {
  id: string;
  placementId: string;
  endorsementId: string;
  originalParticipantId: string | null;
  counterpartyId: string;
  status: PlacementEndorsementParticipantStatus;
  sharePercent: string | null;
  signedLinePercent: string | null;
  notes: string | null;
  counterparty?: {
    id: string;
    name: string;
    registrationNumber: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateEndorsementParticipantPayload {
  counterpartyId: string;
  originalParticipantId?: string;
  sharePercent?: number;
  signedLinePercent?: number;
  status?: PlacementEndorsementParticipantStatus;
}

export interface UpdateEndorsementParticipantPayload extends Partial<CreateEndorsementParticipantPayload> {
  participantId: string;
}

export interface CreateEndorsementPayload {
  type: PlacementEndorsementType;
  impactType?: PlacementEndorsementImpactType;
  effectiveDate: string;
  reason: string;
  description?: string;
  proposedSnapshot?: Record<string, unknown>;
  targetPercent?: number;
}

/* ── Placement Payments ── */
export type PlacementParticipantClosingStatus = 'DRAFT' | 'ISSUED' | 'CONFIRMED' | 'VOID';

export interface PlacementParticipantClosing {
  id: string;
  tenantId: string;
  placementId: string;
  participantId: string;
  closingNumber: string;
  status: PlacementParticipantClosingStatus;
  signedLinePercent: string;
  sharePercent: string | null;
  sumInsuredSnapshot: string | null;
  grossPremium: string | null;
  commissionPercent: string | null;
  commissionAmount: string | null;
  brokeragePercent: string | null;
  brokerageAmount: string | null;
  netPremium: string | null;
  currency: string | null;
  issuedAt: string | null;
  confirmedAt: string | null;
  createdByUserId: string;
  participant: {
    id: string;
    counterpartyId: string;
    role: string;
    status: string;
    counterparty: {
      id: string;
      type: string;
      name: string;
      registrationNumber: string | null;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface AcceptPlacementParticipantResponse {
  participant: PlacementParticipant;
  closing: PlacementParticipantClosing;
}

export type PlacementNoteType =
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE'
  | 'ENDORSEMENT_DEBIT_NOTE'
  | 'ENDORSEMENT_CREDIT_NOTE'
  | 'CURRENT_EFFECTIVE_DEBIT_NOTE';

export type PlacementNoteStatus = 'DRAFT' | 'ISSUED' | 'VOID';

export type PlacementNoteDirection = 'CEDANT_TO_BROKER' | 'BROKER_TO_REINSURER';

export interface PlacementNote {
  id: string;
  tenantId: string;
  placementId: string;
  closingId: string | null;
  participantId: string | null;
  endorsementId: string | null;
  endorsementClosingId: string | null;
  endorsementParticipantId: string | null;
  counterpartyId: string;
  settledByPaymentId: string | null;
  type: PlacementNoteType;
  direction: PlacementNoteDirection;
  noteNumber: string;
  status: PlacementNoteStatus;
  currency: string;
  grossAmount: string;
  commissionPercent: string | null;
  commissionAmount: string | null;
  brokeragePercent: string | null;
  brokerageAmount: string | null;
  nicLevyPercent: string;
  nicLevyAmount: string;
  withholdingTaxPercent: string;
  withholdingTaxAmount: string;
  netAmount: string;
  appliedCharges: Record<string, unknown> | null;
  noteDate: string;
  issuedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  counterparty: {
    id: string;
    type: string;
    name: string;
    registrationNumber: string | null;
  };
  participant: { id: string; counterpartyId: string } | null;
  closing: { id: string; closingNumber: string } | null;
  endorsementParticipant: { id: string; counterpartyId: string } | null;
  endorsementClosing: { id: string; closingNumber: string } | null;
}

export interface EndorsementParticipantClosing {
  id: string;
  placementId: string;
  endorsementId: string;
  endorsementParticipantId: string;
  status: PlacementParticipantClosingStatus;
  closingNumber: string;
  signedLinePercent: string;
  sharePercent: string | null;
  sumInsuredSnapshot: string | null;
  premiumSnapshot: string;
  commissionPercent: string | null;
  commissionAmount: string | null;
  brokeragePercent: string | null;
  brokerageAmount: string | null;
  netPremium: string | null;
  currency: string | null;
  issuedAt: string | null;
  confirmedAt: string | null;
  endorsementParticipant: {
    id: string;
    counterpartyId: string;
    originalParticipantId?: string | null;
    status: PlacementEndorsementParticipantStatus;
    counterparty: {
      id: string;
      name: string;
      registrationNumber: string | null;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface ValidateEndorsementParticipantResponse {
  participant: PlacementEndorsementParticipant;
  closing: EndorsementParticipantClosing;
  summary: PlacementEndorsementSummary;
  effectiveStatus: PlacementEndorsementStatus;
}

export interface ForceCloseEndorsementResponse {
  endorsement: PlacementEndorsement;
  closings: EndorsementParticipantClosing[];
  summary: PlacementEndorsementSummary;
  effectiveStatus: PlacementEndorsementStatus;
}

export type PlacementDocumentType =
  | 'OFFER_SLIP'
  | 'CLOSING_SLIP'
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE'
  | 'ENDORSEMENT_SLIP'
  | 'ENDORSEMENT_CERTIFICATE'
  | 'ENDORSEMENT_DEBIT_NOTE'
  | 'ENDORSEMENT_CREDIT_NOTE'
  | 'CLAIM_CASH_CALL'
  | 'CLAIM_NOTICE';

export type PlacementDocumentStatus = 'DRAFT' | 'GENERATED' | 'FAILED' | 'VOID';

export interface PlacementDocument {
  id: string;
  tenantId: string;
  placementId: string;
  participantId: string | null;
  closingId: string | null;
  noteId: string | null;
  endorsementId: string | null;
  endorsementClosingId: string | null;
  claimId: string | null;
  claimCashCallId: string | null;
  type: PlacementDocumentType;
  status: PlacementDocumentStatus;
  documentNumber: string;
  version: number;
  title: string;
  currency: string | null;
  generatedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  sourceSnapshot?: Record<string, unknown> | null;
  renderPayload?: Record<string, unknown> | null;
}

export type PlacementPaymentType =
  | 'PREMIUM_RECEIVED'
  | 'REINSURER_DISBURSEMENT'
  | 'CLAIM_SETTLEMENT';

export type PlacementPaymentDirection = 'INBOUND' | 'OUTBOUND';
export type PlacementPaymentStatus =
  | 'RECORDED'
  | 'BANK_CONFIRMED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED';
export type PaymentWorklistPaymentStatus = 'Outstanding' | 'Pending' | 'Part Payment' | 'Paid';
export type PaymentWorklistStatusFilter = 'Placed' | 'Closed' | PaymentWorklistPaymentStatus;
export type PlacementSettlementMethod =
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CASH'
  | 'MOBILE_MONEY'
  | 'INTERNAL_OFFSET'
  | 'JOURNAL'
  | 'OTHER';

export interface PlacementPaymentAllocation {
  id: string;
  noteId: string;
  allocatedAmount: string;
  allocatedCurrency: string;
  obligationAmount: string;
  obligationCurrency: string;
  agreedExchangeRate: string | null;
  note: {
    id: string;
    noteNumber: string;
    type: string;
    currency: string;
    nicLevyAmount?: string | null;
    withholdingTaxAmount?: string | null;
    withholdingTaxPercent?: string | null;
  };
}

export interface PlacementPayment {
  id: string;
  tenantId: string;
  placementId: string;
  closingId: string | null;
  endorsementClosingId: string | null;
  participantId: string | null;
  counterpartyId: string;
  type: PlacementPaymentType;
  direction: PlacementPaymentDirection;
  amount: string;
  currency: string;
  paymentDate: string;
  reference: string | null;
  settlementReference: string | null;
  settlementMethod: PlacementSettlementMethod | null;
  settlementCurrency: string | null;
  bankReference: string | null;
  bankConfirmedAt: string | null;
  bankConfirmedByUserId: string | null;
  agreedExchangeRate: string | null;
  bankChargeAmount: string;
  withholdingTaxAmount: string;
  notes: string | null;
  status: PlacementPaymentStatus;
  reversalOfPaymentId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  placement?: {
    id: string;
    reference: string;
    policyNumber: string | null;
    title: string;
    currency?: string | null;
  };
  counterparty: { id: string; type: string; name: string; registrationNumber: string | null };
  participant: { id: string; counterpartyId: string } | null;
  closing: {
    id: string;
    closingNumber: string;
    netPremium?: string | null;
    currency?: string | null;
  } | null;
  endorsementClosing: {
    id: string;
    closingNumber: string;
    netPremium?: string | null;
    currency?: string | null;
    endorsementId?: string;
    endorsement?: {
      id: string;
      endorsementNumber: string;
      effectiveDate: string;
      type: string;
    } | null;
  } | null;
  allocations?: PlacementPaymentAllocation[];
}

export interface PaymentWorklistRow {
  id: string;
  placementId: string;
  reference: string | null;
  policyNumber: string | null;
  title: string;
  classOfBusiness: string | null;
  cedantId: string;
  cedantName: string;
  sumInsured: number | null;
  facultativeOffer: number | null;
  commission: number | null;
  facultativeSumInsured: number | null;
  /**
   * Terms after applying every closed, in-force endorsement. The backend returns the base
   * placement value here when no endorsement applies, so these are always safe to display.
   */
  effectiveSumInsured: number | null;
  effectivePremium: number | null;
  effectiveFacultativeOfferPercent: number | null;
  effectiveFacultativeSumInsured: number | null;
  acceptedParticipantCount: number;
  currency: string | null;
  paidAmount: number;
  outstandingAmount: number;
  outstandingLabel: 'outstanding' | 'credit';
  currentObligation: number;
  latestConfirmedPaymentDate: string | null;
  placementStatus: FacultativeStatus;
  paymentStatus: PaymentWorklistPaymentStatus;
  /** When the offer was entered in the system (placement.createdAt). */
  createdAt: string;
  sortDate: string;
}

export interface PaginatedPaymentWorklist {
  items: PaymentWorklistRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type FacultativeRowPaymentStatus = 'Outstanding' | 'Pending' | 'Part Payment' | 'Paid';

export interface FacultativeRowState {
  placementId: string;
  paymentStatus: FacultativeRowPaymentStatus;
  hasRecordedPayment: boolean;
  nonVoidEndorsementCount: number;
  hasNonVoidEndorsement: boolean;
  /**
   * Terms after applying every closed, in-force endorsement. The backend returns the base
   * placement value here when no endorsement applies, so these are always safe to display.
   */
  effectiveSumInsured: number | null;
  effectivePremium: number | null;
  effectiveFacultativeOfferPercent: number | null;
  effectiveParticipantCount: number;
}

export interface FacultativeRowStateResponse {
  items: FacultativeRowState[];
}

export type PlacementClaimRecoveryReceiptStatus = 'RECORDED' | 'BANK_CONFIRMED' | 'REVERSED';
export type PlacementClaimCedantSettlementStatus = 'RECORDED' | 'BANK_CONFIRMED' | 'REVERSED';
export type PlacementClaimRecoveryStatus =
  | 'UNRECOVERED'
  | 'PARTIALLY_RECOVERED'
  | 'FULLY_RECOVERED';

export interface PlacementClaimRecoveryReceipt {
  id: string;
  tenantId: string;
  placementId: string;
  claimId: string;
  allocationId: string;
  cashCallId: string;
  recoveryApprovalId: string | null;
  counterpartyId: string;
  currency: string;
  amount: string;
  paymentDate: string;
  reference: string | null;
  settlementMethod: PlacementSettlementMethod | null;
  settlementCurrency: string | null;
  bankReference: string | null;
  accountingCashAccountId: string | null;
  bankConfirmedAt: string | null;
  bankConfirmedByUserId: string | null;
  agreedExchangeRate: string | null;
  bankChargeAmount: string;
  notes: string | null;
  status: PlacementClaimRecoveryReceiptStatus;
  reversalOfReceiptId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  counterparty: { id: string; type: string; name: string; registrationNumber: string | null };
}

export interface PlacementClaimCedantSettlement {
  id: string;
  tenantId: string;
  placementId: string;
  claimId: string;
  payableApprovalId: string | null;
  currency: string;
  amount: string;
  settlementDate: string;
  reference: string | null;
  settlementMethod: PlacementSettlementMethod | null;
  settlementCurrency: string | null;
  bankReference: string | null;
  accountingCashAccountId: string | null;
  bankConfirmedAt: string | null;
  bankConfirmedByUserId: string | null;
  agreedExchangeRate: string | null;
  bankChargeAmount: string;
  notes: string | null;
  status: PlacementClaimCedantSettlementStatus;
  reversalOfSettlementId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** A reinsurer's formal agreement to pay a recovery amount — precedes (and may be referenced by) a recovery receipt. */
export interface PlacementClaimRecoveryApproval {
  id: string;
  tenantId: string;
  placementId: string;
  claimId: string;
  allocationId: string;
  cashCallId: string | null;
  counterpartyId: string;
  approvalVersion: number;
  approvedAmount: string;
  eligibleAmount: string;
  currency: string;
  approvedAt: string;
  approvedByUserId: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  counterparty: { id: string; type: string; name: string; registrationNumber: string | null };
}

export interface PlacementClaimRecoveryPositionCashCall {
  cashCallId: string;
  allocationId: string;
  counterpartyId: string;
  counterparty: { id: string; type: string; name: string; registrationNumber: string | null };
  cashCallNumber: string;
  cashCallStatus: PlacementClaimCashCallStatus;
  currency: string;
  calledAmount: string;
  recoveredAmount: string;
  /** Operational receipts recorded but not yet financially confirmed by Accounting. */
  recordedAmount: string;
  /** Bank-confirmed recovery receipts that reduce financial outstanding. */
  confirmedAmount: string;
  reversedAmount: string;
  outstandingAmount: string;
  recoveryStatus: PlacementClaimRecoveryStatus;
  receipts: PlacementClaimRecoveryReceipt[];
}

export interface PlacementClaimRecoveryPosition {
  claimId: string;
  placementId: string;
  currency: string;
  claim: {
    finalLossAmount: string | null;
    approvedPayableAmount: string | null;
    approvedAt: string | null;
    approvedByUserId: string | null;
  };
  recoveries: {
    totalAllocated: string;
    totalCashCalled: string;
    totalRecovered: string;
    /** Operational receipts recorded but not yet financially confirmed by Accounting. */
    totalRecorded: string;
    /** Bank-confirmed recovery receipts that reduce financial outstanding. */
    totalConfirmed: string;
    totalReversed: string;
    totalOutstanding: string;
  };
  perCashCall: PlacementClaimRecoveryPositionCashCall[];
  cedantSettlement: {
    approvedPayableAmount: string | null;
    settledAmount: string;
    /** Operational Cedant settlements recorded but not yet financially confirmed by Accounting. */
    recordedAmount: string;
    /** Bank-confirmed Cedant settlements that reduce financial payable outstanding. */
    bankConfirmedAmount: string;
    reversedAmount: string;
    outstandingAmount: string;
    operationalSettledAmount: string;
    settlementStatus: 'PENDING_APPROVAL' | 'APPROVED_UNSETTLED' | 'PARTIALLY_SETTLED' | 'SETTLED';
  };
  funding: {
    brokerFundedExposure: string;
    recoveredMinusSettled: string;
  };
  cedantSettlementStatus: string;
}

export type ClaimRowBucket = 'notification' | 'open' | 'closed';

export interface ClaimRowState {
  claimId: string;
  placementId: string;
  bucket: ClaimRowBucket;
  recoveredAmount: string;
  recoveredAt: string | null;
  isFullyRecovered: boolean;
  nonVoidEndorsementCount: number;
  hasNonVoidEndorsement: boolean;
}

export interface ClaimRowStateResponse {
  items: ClaimRowState[];
}

export interface ClaimsWorklistPlacement {
  id: string;
  reference: string | null;
  policyNumber: string | null;
  title: string;
  classOfBusiness: string | null;
  riskTypeId: string | null;
  cedant: { id: string; name: string };
  businessDetails: Record<string, unknown> | null;
  offerDetails: Record<string, unknown> | null;
  description: string | null;
  sumInsured: number | null;
  rate: number | null;
  commission: number | null;
  facultativeOffer: number | null;
  premium: number | null;
  currency: string | null;
  inceptionDate: string | null;
  expiryDate: string | null;
  status: FacultativeStatus;
  createdAt: string;
  updatedAt: string;
  archivedByUserId: string | null;
  archiveReason: string | null;
  archivedAt: string | null;
  closeMode: string | null;
  forceClosedAt: string | null;
  forceClosedByUserId: string | null;
}

export interface ClaimsWorklistRow {
  id: string;
  claimId: string;
  placementId: string;
  bucket: ClaimRowBucket;
  placement: ClaimsWorklistPlacement;
  claim: PlacementClaim;
  recoveredAmount: number;
  recoveredAt: string | null;
  isFullyRecovered: boolean;
  claimShare: number;
  nonVoidEndorsementCount: number;
  hasNonVoidEndorsement: boolean;
}

export interface PaginatedClaimsWorklist {
  items: ClaimsWorklistRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ClaimsCurrencyAmount {
  code: string;
  amount: number;
}

export interface ClaimsWorklistSummary {
  totalClaims: number;
  settledClaims: number;
  notificationClaims: number;
  openClaims: number;
  /** Open-bucket claims still PENDING (no allocations). */
  openPendingClaims: number;
  /** Open-bucket claims FINALIZED (allocations generated). */
  openFinalizedClaims: number;
  closedClaims: number;
  claimsByCurrency: ClaimsCurrencyAmount[];
  recoveredByCurrency: ClaimsCurrencyAmount[];
  /** Open-bucket claim share minus recoveries received, per currency. */
  outstandingRecoveredByCurrency: ClaimsCurrencyAmount[];
}

export interface ApprovePlacementClaimPayablePayload {
  approvedPayableAmount: number;
  notes?: string;
}

export interface ApprovePlacementClaimRecoveryPayload {
  approvedAmount: number;
  currency?: string;
  cashCallId?: string;
  reference?: string;
  notes?: string;
}

export interface CreatePlacementClaimCedantSettlementPayload {
  payableApprovalId?: string;
  currency: string;
  amount: number;
  settlementDate: string;
  settlementMethod?: PlacementSettlementMethod;
  settlementCurrency?: string;
  agreedExchangeRate?: number;
  reference?: string;
  notes?: string;
}

export interface CreatePlacementClaimRecoveryReceiptPayload {
  recoveryApprovalId?: string;
  currency: string;
  amount: number;
  paymentDate: string;
  settlementMethod?: PlacementSettlementMethod;
  settlementCurrency?: string;
  agreedExchangeRate?: number;
  reference?: string;
  notes?: string;
}

/** Reinsurance-owned financial confirmation that a Cedant settlement / recovery receipt cleared. */
export interface ConfirmPlacementClaimFinancialBankPayload {
  bankConfirmedAt: string;
  bankReference?: string;
  accountingCashAccountId?: string;
  settlementMethod?: PlacementSettlementMethod;
  settlementCurrency?: string;
  confirmedExchangeRate?: number;
  /** @deprecated use confirmedExchangeRate */
  agreedExchangeRate?: number;
  bankChargeAmount?: number;
  notes?: string;
}

export type ConfirmPlacementClaimCedantSettlementBankPayload =
  ConfirmPlacementClaimFinancialBankPayload;
export type ConfirmPlacementClaimRecoveryReceiptBankPayload =
  ConfirmPlacementClaimFinancialBankPayload;

/* ── Claim financial-close readiness ── */
export const PLACEMENT_CLAIM_FINANCIAL_CLOSE_BLOCKERS = [
  'PAYABLE_NOT_APPROVED',
  'CLAIM_PAYABLE_OUTSTANDING',
  'RECOVERY_OUTSTANDING',
  'CEDANT_SETTLEMENT_CONFIRMATION_PENDING',
  'RECOVERY_RECEIPT_CONFIRMATION_PENDING',
] as const;

export type PlacementClaimFinancialCloseBlocker =
  (typeof PLACEMENT_CLAIM_FINANCIAL_CLOSE_BLOCKERS)[number];

export interface PlacementClaimFinancialCloseReadiness {
  claimId: string;
  currentClaimStatus: PlacementClaimStatus;
  payable: {
    approvedPayableAmount: string | null;
    bankConfirmedSettledAmount: string;
    outstandingPayable: string;
  };
  recovery: {
    approvedRecoveryAmount: string;
    bankConfirmedRecoveryAmount: string;
    outstandingRecovery: string;
  };
  pendingConfirmations: {
    recordedCedantSettlementCount: number;
    recordedCedantSettlementAmount: string;
    recordedRecoveryReceiptCount: number;
    recordedRecoveryReceiptAmount: string;
  };
  isPayableFullySettled: boolean;
  areRecoveriesFullyReceived: boolean;
  hasPendingFinancialConfirmations: boolean;
  isFinanciallyReadyToSettle: boolean;
  isFinanciallyReadyToClose: boolean;
  blockers: PlacementClaimFinancialCloseBlocker[];
}

export interface CreatePlacementPaymentPayload {
  type: PlacementPaymentType;
  direction: PlacementPaymentDirection;
  counterpartyId: string;
  closingId?: string;
  endorsementClosingId?: string;
  participantId?: string;
  amount: number;
  currency: string;
  paymentDate: string;
  settlementMethod?: PlacementSettlementMethod;
  settlementCurrency?: string;
  reference?: string;
  notes?: string;
}

export interface ConfirmPlacementPaymentBankPayload {
  bankConfirmedAt: string;
  bankReference?: string;
  notes?: string;
  /** Currency the counterparty actually settled in, when it differs from the obligation
   * currency. Persisted so cross-currency receipts can be shown in the money that moved. */
  settlementCurrency?: string;
  /** Obligation-currency units per 1 unit of `settlementCurrency` (obligation = settlement × rate). */
  agreedExchangeRate?: number;
}

export type PlacementFinancialPositionState =
  | 'RECEIVABLE'
  | 'PAYABLE'
  | 'SETTLED'
  | 'CREDIT_BALANCE';

export interface PlacementFinancialPositionAdjustment {
  sourceType: 'PLACEMENT_CLOSING' | 'ENDORSEMENT_CLOSING';
  closingId: string;
  endorsementId: string | null;
  endorsementNumber: string | null;
  counterpartyId: string | null;
  originalParticipantId: string | null;
  amount: number;
  currency: string;
  effectiveDate: string | null;
}

export interface PlacementCedantFinancialPosition {
  originalObligation: number;
  endorsementAdjustments: number;
  currentObligation: number;
  received: number;
  refunded: number;
  grossRecorded: number;
  reversed: number;
  netSettled: number;
  outstanding: number;
  position: PlacementFinancialPositionState;
}

export interface PlacementReinsurerFinancialPosition {
  counterpartyId: string;
  counterpartyName: string;
  originalPayable: number;
  endorsementAdjustments: number;
  currentEffectivePayable: number;
  paid: number;
  refunded: number;
  grossRecorded: number;
  reversed: number;
  netSettled: number;
  outstanding: number;
  position: PlacementFinancialPositionState;
  adjustments: PlacementFinancialPositionAdjustment[];
}

export interface PlacementFinancialPosition {
  placementId: string;
  asOfDate: string;
  currency: string | null;
  isMultiCurrency: boolean;
  cedant: PlacementCedantFinancialPosition;
  reinsurers: PlacementReinsurerFinancialPosition[];
  adjustments: PlacementFinancialPositionAdjustment[];
  warnings: string[];
}

/* ── Placement Claims ── */
export type PlacementClaimStatus =
  | 'DRAFT'
  | 'NOTIFIED'
  | 'RESERVED'
  | 'PARTIALLY_SETTLED'
  | 'SETTLED'
  | 'DECLINED'
  | 'CLOSED'
  | 'VOID';

export type PlacementClaimAllocationStatus =
  | 'DRAFT'
  | 'NOTIFIED'
  | 'CASH_CALLED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'VOID';

export type PlacementClaimCashCallStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';

/** Orthogonal to {@link PlacementClaimStatus}. FINALIZED is the point at which
 *  reinsurer liability allocations are generated and the claim's financial
 *  inputs (occurrence date, currency, loss amounts) lock. */
export type ClaimState = 'PENDING' | 'FINALIZED';

export interface PlacementClaim {
  id: string;
  tenantId: string;
  placementId: string;
  claimNumber: string;
  status: PlacementClaimStatus;
  claimState: ClaimState;
  occurrenceDate: string;
  reportedDate: string;
  claimCause: string;
  occurrenceDetails: string | null;
  currency: string;
  estimatedLossAmount: string;
  finalLossAmount: string | null;
  finalizedAt: string | null;
  finalizedByUserId: string | null;
  approvedPayableAmount: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
  closedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** @deprecated Superseded by {@link claimState}. Kept only for the form's lowercase
   *  Pending/Finalized selector value. */
  claimTag?: 'pending' | 'finalized' | null;
}

export interface CreatePlacementClaimPayload {
  claimNumber: string;
  occurrenceDate: string;
  reportedDate: string;
  claimCause: string;
  occurrenceDetails?: string;
  currency: string;
  estimatedLossAmount: number;
  finalLossAmount?: number;
  /** FINALIZED generates reinsurer liability allocations server-side and requires
   *  finalLossAmount. Omit or PENDING to record the claim without allocations. */
  claimState?: ClaimState;
}

export type UpdatePlacementClaimPayload = Partial<CreatePlacementClaimPayload>;

export interface PlacementClaimAllocation {
  id: string;
  tenantId: string;
  claimId: string;
  placementId: string;
  placementClosingId: string | null;
  endorsementClosingId: string | null;
  participantId: string | null;
  endorsementParticipantId: string | null;
  counterpartyId: string;
  signedLinePercent: string;
  basisAmount: string;
  allocatedEstimatedLossAmount: string;
  allocatedFinalLossAmount: string | null;
  cashCallAmount: string | null;
  paidAmount: string | null;
  status: PlacementClaimAllocationStatus;
  createdAt: string;
  updatedAt: string;
  counterparty: {
    id: string;
    type: CounterpartyType;
    name: string;
    registrationNumber: string | null;
  };
  placementClosing: { id: string; closingNumber: string } | null;
  endorsementClosing: { id: string; closingNumber: string } | null;
}

export interface PlacementClaimCashCall {
  id: string;
  tenantId: string;
  placementId: string;
  claimId: string;
  allocationId: string;
  counterpartyId: string;
  cashCallNumber: string;
  status: PlacementClaimCashCallStatus;
  currency: string;
  amount: string;
  basisAmount: string;
  signedLinePercent: string;
  issuedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  counterparty: {
    id: string;
    type: CounterpartyType;
    name: string;
    registrationNumber: string | null;
  };
  allocation: {
    id: string;
    status: PlacementClaimAllocationStatus;
  };
}

export interface UpdatePlacementClaimCashCallStatusPayload {
  status: Exclude<PlacementClaimCashCallStatus, 'PAID'>;
}

export interface VoidPlacementClaimCashCallPayload {
  voidReason: string;
}

/* ── Facultative form ── */
export interface FacultativeFormValues {
  insuranceCompany: string;
  riskClassId: string;
  riskType: string;
  reference: string;
  policyNumber: string;
  title: string;
  insured: string;
  sumInsured: number | '';
  rate: number | '';
  premium: number | '';
  facultativeOffer: number | '';
  commission: number | '';
  currency: string;
  periodFrom: string;
  periodTo: string;
  comment: string;
  riskDetails: Record<string, unknown>;
  /** Per-fieldKey opt-out from appearing on generated documents (Slip, Notes, etc.).
   *  Absent/true = shown; false = hidden. Only applies to document rendering — the
   *  field always stays visible on this form. */
  riskDetailsVisibility: Record<string, boolean>;
  extraRiskFields: {
    id?: string;
    label: string;
    value: string;
    type?: 'TEXT';
    displayOrder?: number;
    /** Same opt-out as riskDetailsVisibility, but inline since extra fields aren't keyed by a schema fieldKey. */
    showOnDocument?: boolean;
  }[];
}

export const FACULTATIVE_FORM_DEFAULTS: FacultativeFormValues = {
  insuranceCompany: '',
  riskClassId: '',
  riskType: '',
  reference: '',
  policyNumber: '',
  title: '',
  insured: '',
  sumInsured: '',
  rate: '',
  premium: '',
  facultativeOffer: '',
  commission: '',
  currency: '',
  periodFrom: '',
  periodTo: '',
  comment: '',
  riskDetails: {},
  riskDetailsVisibility: {},
  extraRiskFields: [],
};

export const TREATY_TYPES = [
  'Quota Share',
  'Surplus',
  'Fac. Obligatory Treaty',
  'Excess of Loss',
] as const;

export const TREATY_STATUSES = ['Active', 'Pending', 'Expired', 'Cancelled'] as const;

export type TreatyType = (typeof TREATY_TYPES)[number];
export type TreatyStatus = (typeof TREATY_STATUSES)[number];

/* ── Table row shape ── */
export interface Treaty {
  id: string;
  name: string;
  type: TreatyType;
  classofBusiness: string;
  cedant: string;
  share: number; // reinsurer's share 0-100
  accountingArrangement: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  year: number;
  status: TreatyStatus;
}

/* ── Quota Share form ── */

export interface ReinsurerPanelRow {
  reinsurer: string;
  reinsurerShare: number | '';
}

export const DEFAULT_REINSURER_ROW: ReinsurerPanelRow = {
  reinsurer: '',
  reinsurerShare: '',
};

export const TERRITORIAL_SCOPE_OPTIONS = [
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Africa', label: 'Africa' },
  { value: 'Europe', label: 'Europe' },
  { value: 'Asia', label: 'Asia' },
  { value: 'Rest of the World', label: 'Rest of the World' },
];

export const ACCOUNTING_ARRANGEMENT_OPTIONS = [
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Semi-Annual', label: 'Semi-Annual' },
  { value: 'Annual', label: 'Annual' },
];

export const CURRENCY_OPTIONS = [
  { value: 'GHC', label: 'GHC – Ghana Cedi' },
  { value: 'USD', label: 'USD – US Dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'GBP', label: 'GBP – British Pound' },
  { value: 'NGN', label: 'NGN – Nigerian Naira' },
];

export interface QuotaShareFormValues {
  classOfBusiness: string;
  year: string;
  treatyName: string;
  territorialScope: string;
  accountingArrangement: string;
  currency: string;
  cedantCompany: string;
  broker: string;
  effectiveDate: string;
  expiryDate: string;
  cedantCommission: number | '';
  brokerageFee: number | '';
  limitOfLiability: number | '';
  cedantShare: number | '';
  reinsuranceShare: number | '';
  yourShare: number | '';
  reinsurerPanel: ReinsurerPanelRow[];
  supportingDocument: File | null;
}

/* ── Surplus form ── */
export interface SurplusFormValues {
  classOfBusiness: string;
  year: string;
  treatyName: string;
  territorialScope: string;
  accountingArrangement: string;
  currency: string;
  cedantCompany: string;
  broker: string;
  effectiveDate: string;
  expiryDate: string;
  cedantCommission: number | '';
  brokerageFee: number | '';
  /** The cedant's own retention per risk */
  cedantRetentionLine: number | '';
  /** Number of lines the reinsurer accepts above the retention */
  reinsuranceLine: number | '';
  /** totalCapacity = cedantRetentionLine × reinsuranceLine — computed, never submitted */
  yourShare: number | '';
  supportingDocument: File | null;
}

export const SURPLUS_DEFAULTS: SurplusFormValues = {
  classOfBusiness: '',
  year: String(new Date().getFullYear()),
  treatyName: '',
  territorialScope: '',
  accountingArrangement: '',
  currency: '',
  cedantCompany: '',
  broker: '',
  effectiveDate: '',
  expiryDate: '',
  cedantCommission: '',
  brokerageFee: '',
  cedantRetentionLine: '',
  reinsuranceLine: '',
  yourShare: '',
  supportingDocument: null,
};

/* ── Excess of Loss form ── */
export const EXCESS_OF_LOSS_TYPE_OPTIONS = [
  { value: 'Aggregate', label: 'Aggregate' },
  { value: 'Per Risk', label: 'Per Risk' },
  { value: 'Catastrophe', label: 'Catastrophe' },
];

export const BASIS_OF_ATTACHMENT_OPTIONS = [
  { value: 'Losses Occurring', label: 'Losses Occurring' },
  { value: 'Risk Attaching', label: 'Risk Attaching' },
];

export const REINSTATEMENT_TYPE_OPTIONS = [
  { value: 'Free', label: 'Free' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Pro-Rate', label: 'Pro-Rate' },
  { value: 'Full', label: 'Full' },
];

export interface TreatyLayer {
  name: string;
  retention: number | '';
  limit: number | '';
  reinstatements: number | '';
  reinstatementsType: string;
}

export const DEFAULT_TREATY_LAYER: TreatyLayer = {
  name: '',
  retention: '',
  limit: '',
  reinstatements: '',
  reinstatementsType: '',
};

export interface ExcessOfLossFormValues {
  classOfBusiness: string;
  excessOfLossType: string;
  year: string;
  treatyName: string;
  territorialScope: string;
  accountingArrangement: string;
  currency: string;
  cedantCompany: string;
  broker: string;
  effectiveDate: string;
  expiryDate: string;
  brokerageFee: number | '';
  basisOfAttachment: string;
  egnpi: number | '';
  rate: number | '';
  mAndD: number | '';
  layers: TreatyLayer[];
  reinsurerShare: number | '';
  yourShare: number | '';
  supportingDocument: File | null;
}

export const EXCESS_OF_LOSS_DEFAULTS: ExcessOfLossFormValues = {
  classOfBusiness: '',
  excessOfLossType: '',
  year: String(new Date().getFullYear()),
  treatyName: '',
  territorialScope: '',
  accountingArrangement: '',
  currency: '',
  cedantCompany: '',
  broker: '',
  effectiveDate: '',
  expiryDate: '',
  brokerageFee: '',
  basisOfAttachment: '',
  egnpi: '',
  rate: '',
  mAndD: '',
  layers: [{ ...DEFAULT_TREATY_LAYER }],
  reinsurerShare: '',
  yourShare: '',
  supportingDocument: null,
};

/* ── Fac. Obligatory Treaty form ── */
export interface FacObligatoryFormValues {
  classOfBusiness: string;
  year: string;
  treatyName: string;
  territorialScope: string;
  accountingArrangement: string;
  currency: string;
  cedantCompany: string;
  broker: string;
  effectiveDate: string;
  expiryDate: string;
  cedantCommission: number | '';
  brokerageFee: number | '';
  reinsurererShare: number | '';
  yourShare: number | '';
  supportingDocument: File | null;
}

export const FAC_OBLIGATORY_DEFAULTS: FacObligatoryFormValues = {
  classOfBusiness: '',
  year: String(new Date().getFullYear()),
  treatyName: '',
  territorialScope: '',
  accountingArrangement: '',
  currency: '',
  cedantCompany: '',
  broker: '',
  effectiveDate: '',
  expiryDate: '',
  cedantCommission: '',
  brokerageFee: '',
  reinsurererShare: '',
  yourShare: '',
  supportingDocument: null,
};

/* ── Bank ── */
export interface Bank {
  id: string;
  tenantId: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branchName: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankFormValues {
  accountName: string;
  accountNumber: string;
  bankName: string;
  branchName: string;
}

/* ── Levy & Tax ── */
export type ReinsuranceChargeCode = 'NIC_LEVY' | 'WITHHOLDING_TAX';
export type ReinsuranceChargeType = 'TAX' | 'LEVY' | 'FEE' | 'DUTY' | 'OTHER';
export type ReinsuranceChargeRateType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type ReinsuranceChargeCalculationBasis =
  | 'GROSS_AMOUNT'
  | 'COMMISSION_AMOUNT'
  | 'BROKERAGE_AMOUNT'
  | 'NET_BEFORE_CHARGES';
export type ReinsuranceChargeDirection = 'ADDITION' | 'DEDUCTION';
export type ReinsuranceChargeRoundingMode = 'HALF_UP' | 'UP' | 'DOWN';

export interface ReinsuranceChargeConfiguration {
  id: string;
  tenantId: string;
  code: ReinsuranceChargeCode;
  name: string;
  chargeType: ReinsuranceChargeType;
  rateType: ReinsuranceChargeRateType;
  rate: string;
  calculationBasis: ReinsuranceChargeCalculationBasis;
  direction: ReinsuranceChargeDirection;
  currency: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  roundingMode: ReinsuranceChargeRoundingMode;
  decimalPlaces: number;
  isEnabled: boolean;
  displayOrder: number;
}

export interface ReinsuranceChargeTemplate {
  code: ReinsuranceChargeCode;
  name: string;
  chargeType: ReinsuranceChargeType;
  rateType: ReinsuranceChargeRateType;
  calculationBasis: ReinsuranceChargeCalculationBasis;
  direction: ReinsuranceChargeDirection;
  description: string;
}

export interface ReinsuranceChargePayload {
  code: ReinsuranceChargeCode;
  name: string;
  chargeType: ReinsuranceChargeType;
  rateType: ReinsuranceChargeRateType;
  rate: number;
  calculationBasis: ReinsuranceChargeCalculationBasis;
  direction: ReinsuranceChargeDirection;
  currency?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  roundingMode?: ReinsuranceChargeRoundingMode;
  decimalPlaces?: number;
  isEnabled?: boolean;
  displayOrder?: number;
}

export type ReinsuranceChargeUpdatePayload = Omit<ReinsuranceChargePayload, 'code'>;

export interface ReinsuranceChargePreviewLine {
  configurationId: string;
  code: ReinsuranceChargeCode;
  name: string;
  chargeType: ReinsuranceChargeType;
  rateType: ReinsuranceChargeRateType;
  rate: string;
  calculationBasis: ReinsuranceChargeCalculationBasis;
  direction: ReinsuranceChargeDirection;
  currency: string | null;
  basisAmount: number;
  amount: number;
}

export interface ReinsuranceChargePreviewResult {
  currency: string;
  grossAmount: number;
  commissionAmount: number;
  brokerageAmount: number;
  netBeforeCharges: number;
  additions: number;
  deductions: number;
  netAmount: number;
  charges: ReinsuranceChargePreviewLine[];
}

export interface LevyTaxFormValues {
  id?: string;
  code: ReinsuranceChargeCode;
  name: string;
  chargeType: ReinsuranceChargeType;
  rateType: ReinsuranceChargeRateType;
  rate: number | '';
  calculationBasis: ReinsuranceChargeCalculationBasis;
  direction: ReinsuranceChargeDirection;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string;
  roundingMode: ReinsuranceChargeRoundingMode;
  decimalPlaces: number;
  isEnabled: boolean;
  displayOrder: number;
}

export const LEVY_TAX_FORM_DEFAULTS: LevyTaxFormValues = {
  code: 'NIC_LEVY',
  name: 'NIC Levy',
  chargeType: 'LEVY',
  rateType: 'PERCENTAGE',
  rate: '',
  calculationBasis: 'NET_BEFORE_CHARGES',
  direction: 'DEDUCTION',
  currency: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
  roundingMode: 'HALF_UP',
  decimalPlaces: 4,
  isEnabled: true,
  displayOrder: 0,
};

export const BANK_FORM_DEFAULTS: BankFormValues = {
  accountName: '',
  accountNumber: '',
  bankName: '',
  branchName: '',
};

export interface CreateBankPayload {
  accountName: string;
  accountNumber: string;
  bankName: string;
  branchName: string;
}
export type UpdateBankPayload = Partial<CreateBankPayload>;

export const QUOTA_SHARE_DEFAULTS: QuotaShareFormValues = {
  classOfBusiness: '',
  year: String(new Date().getFullYear()),
  treatyName: '',
  territorialScope: '',
  accountingArrangement: '',
  currency: '',
  cedantCompany: '',
  broker: '',
  effectiveDate: '',
  expiryDate: '',
  cedantCommission: '',
  brokerageFee: '',
  limitOfLiability: '',
  cedantShare: '',
  reinsuranceShare: '',
  yourShare: '',
  reinsurerPanel: [{ ...DEFAULT_REINSURER_ROW }],
  supportingDocument: null,
};

export type MailboxProvider = 'MICROSOFT_GRAPH' | 'GOOGLE_GMAIL';
export type MailboxConnectionStatus = 'ACTIVE' | 'DISCONNECTED' | 'ERROR';

export interface MailboxConnection {
  id: string;
  tenantId: string;
  provider: MailboxProvider;
  emailAddress: string;
  normalizedEmail: string;
  displayName: string | null;
  status: MailboxConnectionStatus;
  externalMailboxId: string | null;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  connectedByUserId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectMailboxPayload {
  provider: MailboxProvider;
  emailAddress: string;
  displayName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
}

export interface PaginatedMailboxes {
  items: MailboxConnection[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface MailboxSyncResponse {
  mailbox: MailboxConnection;
  threadsSynced: number;
  messagesSynced: number;
}

export interface EmailParticipant {
  email?: string;
  name?: string;
}

export interface EmailThreadParticipants {
  from?: EmailParticipant;
  to?: EmailParticipant[];
  cc?: EmailParticipant[];
}

export type EmailMessageDirection = 'INBOUND' | 'OUTBOUND';
export type EmailMessageStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'FAILED';

export interface EmailAttachmentMetadata {
  id: string;
  messageId: string;
  providerAttachmentId: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  isInline: boolean;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  mailboxConnectionId: string;
  direction: EmailMessageDirection;
  status: EmailMessageStatus;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toRecipients: EmailParticipant[] | null;
  ccRecipients: EmailParticipant[] | null;
  receivedAt: string | null;
  sentAt: string | null;
  bodyPreview: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  hasAttachments: boolean;
  isRead: boolean;
  attachments: EmailAttachmentMetadata[];
}

export interface EmailThread {
  id: string;
  mailboxConnectionId: string;
  subject: string | null;
  participants: EmailThreadParticipants | null;
  lastMessageAt: string | null;
  messageCount: number;
  hasAttachments: boolean;
  createdAt: string;
  updatedAt: string;
  /** Undocumented-but-real: up to 5 most-recent messages, included on both list and detail responses. */
  messages: EmailMessage[];
}

export interface PaginatedEmailThreads {
  items: EmailThread[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
