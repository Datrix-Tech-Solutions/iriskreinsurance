export const LEGACY_SOURCE_SYSTEM = 'legacy-irisk-graphql';

export const LEGACY_TOLERANCES = {
  percentage: '0.01',
  money: '0.05',
  sumInsured: '0.05',
  offeredVsPlaced: '0.01',
} as const;

export type LegacyImportMode = 'dry-run' | 'apply' | 'rollback';

export type LegacyOfferClassification =
  | 'AUTO_SAFE'
  | 'NEEDS_FINANCIAL_REVIEW'
  | 'DATA_MISMATCH';

export type LegacySeverity = 'info' | 'warning' | 'error';

export type LegacyValidationIssue = {
  offerId?: string;
  entityType: string;
  legacyId?: string;
  severity: LegacySeverity;
  code: string;
  message: string;
  path: string;
  rawValue?: unknown;
};

export type LegacyAddress = {
  street?: string | null;
  suburb?: string | null;
  region?: string | null;
  country?: string | null;
};

export type LegacyClassOfBusiness = {
  class_of_business_id?: string | null;
  business_name?: string | null;
  business_details?: string | null;
};

export type LegacyInsurer = {
  insurer_id?: string | null;
  insurer_company_name?: string | null;
  insurer_company_email?: string | null;
  insurer_company_website?: string | null;
  insurer_address?: LegacyAddress | null;
};

export type LegacyReinsurer = {
  reinsurer_id?: string | null;
  re_company_name?: string | null;
  re_company_email?: string | null;
  reinsurer_address?: LegacyAddress | null;
};

export type LegacyOfferDetail = {
  offer_detail_id?: string | null;
  policy_number?: string | null;
  insured_by?: string | null;
  period_of_insurance_from?: string | null;
  period_of_insurance_to?: string | null;
  currency?: string | null;
  offer_comment?: string | null;
  offer_details?: string | null;
};

export type LegacyOfferExtraCharges = {
  agreed_brokerage_percentage?: number | string | null;
  agreed_commission?: number | string | null;
  agreed_commission_amount?: number | string | null;
  brokerage_amount?: number | string | null;
  nic_levy?: number | string | null;
  nic_levy_amount?: number | string | null;
  withholding_tax?: number | string | null;
  withholding_tax_amount?: number | string | null;
};

export type LegacyOfferParticipant = {
  offer_participant_id?: string | null;
  offer_participant_percentage?: number | string | null;
  offer_amount?: number | string | null;
  participant_fac_premium?: number | string | null;
  participant_fac_sum_insured?: number | string | null;
  offer_extra_charges?: LegacyOfferExtraCharges | null;
  offer_deduction_charge?: Record<string, unknown> | null;
  reinsurer?: LegacyReinsurer | null;
};

export type LegacyOfferClaimParticipant = {
  offer_claim_participant_id?: string | null;
  reinsurer_id?: string | null;
  offer_participantsoffer_participant_id?: string | null;
  offer_participant_percentage?: number | string | null;
  claim_share?: number | string | null;
};

export type LegacyOfferClaim = {
  offer_claim_id?: string | null;
  claim_amount?: number | string | null;
  claim_date?: string | null;
  created_at?: string | null;
  offer_claim_participants?: LegacyOfferClaimParticipant[] | null;
};

export type LegacyOfferEndorsement = {
  offer_endorsement_id?: string | null;
  approval_status?: string | null;
};

export type LegacyOffer = {
  offer_id?: string | null;
  offer_status?: string | null;
  payment_status?: string | null;
  claim_status?: string | null;
  sum_insured?: number | string | null;
  premium?: number | string | null;
  rate?: number | string | null;
  commission?: number | string | null;
  commission_amount?: number | string | null;
  facultative_offer?: number | string | null;
  placed_share?: number | string | null;
  fac_premium?: number | string | null;
  fac_sum_insured?: number | string | null;
  created_at?: string | null;
  insurer?: LegacyInsurer | null;
  classofbusiness?: LegacyClassOfBusiness | null;
  employee?: Record<string, unknown> | null;
  offer_detail?: LegacyOfferDetail | null;
  offer_participant?: LegacyOfferParticipant[] | null;
  offer_claims?: LegacyOfferClaim[] | null;
  offer_endorsements?: LegacyOfferEndorsement[] | null;
};

export type NormalizedLegacyParticipant = {
  source: LegacyOfferParticipant;
  rawHash: string;
  participantId: string;
  reinsurerId: string;
  reinsurerName: string;
  percentage: string;
  offerAmount: string;
  facPremium: string;
  facSumInsured: string;
  hasDeduction: boolean;
  brokerageFee: string | null;
};

export type LegacyRiskField = {
  key: string;
  normalizedKey: string;
  value?: unknown;
};

export type NormalizedLegacyOffer = {
  source: LegacyOffer;
  rawHash: string;
  offerId: string;
  reference: string;
  normalizedReference: string;
  policyNumber: string;
  title: string;
  currency: string;
  offerStatus: string;
  paymentStatus: string;
  claimStatus: string;
  classId: string;
  className: string;
  insurerId: string;
  insurerName: string;
  inceptionDate: Date | null;
  expiryDate: Date | null;
  numbers: {
    sumInsured: string;
    premium: string;
    rate: string | null;
    commission: string | null;
    commissionAmount: string;
    facultativeOffer: string;
    placedShare: string;
    facPremium: string;
    facSumInsured: string;
  };
  businessFields: LegacyRiskField[];
  offerFields: LegacyRiskField[];
  participants: NormalizedLegacyParticipant[];
  claims: LegacyOfferClaim[];
  endorsements: LegacyOfferEndorsement[];
};

export type LegacyFinancialReconciliation = {
  offerId: string;
  sums: Record<string, string>;
  deltas: Record<string, string>;
  mismatches: {
    percentage: boolean;
    facPremium: boolean;
    facSumInsured: boolean;
    commissionAmount: boolean;
    materialOfferedVsPlaced: boolean;
  };
};

export type LegacyClassificationResult = {
  offerId: string;
  classification: LegacyOfferClassification;
  reasons: string[];
  reconciliation: LegacyFinancialReconciliation;
};

export type LegacyImportPlanRecord = {
  offerId: string;
  classification: LegacyOfferClassification;
  action: 'create' | 'skip' | 'update' | 'conflict' | 'reject' | 'review';
  reasons: string[];
  rawHash: string;
  currentPlacementId?: string;
  errors: LegacyValidationIssue[];
};

export type LegacyImportPlan = {
  tenantSlug: string;
  tenantId?: string;
  sourceSystem: string;
  sourceFilePath: string;
  sourceFileHash: string;
  mode: LegacyImportMode;
  fixtureOfferIds: string[];
  counts: {
    creates: Record<string, number>;
    skips: number;
    updates: number;
    conflicts: number;
    financialReview: number;
    rejected: number;
  };
  classification: Record<LegacyOfferClassification, number>;
  duplicateLegacyIds: LegacyValidationIssue[];
  repeatedPolicyNumbers: Array<{ policyNumber: string; offerIds: string[] }>;
  records: LegacyImportPlanRecord[];
  errors: LegacyValidationIssue[];
};

export type LegacyDbPlanAction = 'create' | 'reuse' | 'skip' | 'conflict';

export type LegacyDbPlannedEntity = {
  entityType: string;
  legacyId: string;
  action: LegacyDbPlanAction;
  currentId?: string;
  currentModel?: string;
  reason: string;
};

export type LegacyDbAwareDryRunResolution = {
  resolveDb: true;
  tenant: {
    slug: string;
    id: string;
    name?: string;
  };
  importUserCandidate: {
    id: string;
    email?: string;
    role?: string;
  } | null;
  trackingTablesAvailable: boolean;
  plannedEntities: {
    currencies: LegacyDbPlannedEntity[];
    counterparties: LegacyDbPlannedEntity[];
    addresses: LegacyDbPlannedEntity[];
    riskClasses: LegacyDbPlannedEntity[];
    riskTypes: LegacyDbPlannedEntity[];
    riskTypeFields: LegacyDbPlannedEntity[];
    placements: LegacyDbPlannedEntity[];
    participants: LegacyDbPlannedEntity[];
  };
  readCounts: Record<string, number>;
};
