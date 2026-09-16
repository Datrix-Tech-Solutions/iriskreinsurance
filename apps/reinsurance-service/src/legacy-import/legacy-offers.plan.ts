import {
  LEGACY_SOURCE_SYSTEM,
  LegacyImportMode,
  LegacyImportPlan,
  LegacyImportPlanRecord,
  LegacyOffer,
  LegacyOfferClassification,
  LegacyValidationIssue,
  NormalizedLegacyOffer,
} from './legacy-import.types';
import { LegacyOffersClassifier } from './legacy-offers.classifier';
import { LegacyOffersNormalizer } from './legacy-offers.normalizer';
import { LegacyOffersValidator } from './legacy-offers.validator';
import { resolveLegacyRiskClass } from './legacy-risk-taxonomy';

export type ExistingImportMap = {
  entityType: string;
  legacyId: string;
  currentModel: string;
  currentId: string;
  rawHash: string;
};

export type BuildLegacyImportPlanInput = {
  tenantSlug: string;
  tenantId?: string;
  sourceFilePath: string;
  sourceFileHash: string;
  offers: LegacyOffer[];
  mode: LegacyImportMode;
  fixtureOfferIds?: string[];
  batchSelection?: LegacyImportPlan['batchSelection'];
  existingMaps?: ExistingImportMap[];
};

export class LegacyOffersPlanGenerator {
  constructor(
    private readonly validator = new LegacyOffersValidator(),
    private readonly normalizer = new LegacyOffersNormalizer(),
    private readonly classifier = new LegacyOffersClassifier(),
  ) {}

  build(input: BuildLegacyImportPlanInput): LegacyImportPlan {
    const fixtureOfferIds = input.fixtureOfferIds ?? [];
    const selectedOffers =
      fixtureOfferIds.length > 0
        ? input.offers.filter((offer) =>
            fixtureOfferIds.includes(String(offer.offer_id)),
          )
        : input.offers;
    const validationIssues = [
      ...this.validator.validate(selectedOffers),
      ...unmappedRiskClassIssues(selectedOffers),
    ];
    const duplicateLegacyIds = validationIssues.filter(
      (issue) => issue.code === 'DUPLICATE_LEGACY_ID',
    );
    const repeatedPolicyNumbers =
      this.validator.repeatedPolicyNumbers(selectedOffers);
    const issuesByOffer = groupIssuesByOffer(validationIssues);
    const existing = new Map(
      (input.existingMaps ?? []).map((map) => [
        `${map.entityType}:${map.legacyId}`,
        map,
      ]),
    );

    const records: LegacyImportPlanRecord[] = [];
    const classification: Record<LegacyOfferClassification, number> = {
      AUTO_SAFE: 0,
      NEEDS_FINANCIAL_REVIEW: 0,
      DATA_MISMATCH: 0,
    };

    for (const sourceOffer of selectedOffers) {
      const offerId = String(sourceOffer.offer_id ?? '');
      const offerErrors = issuesByOffer.get(offerId) ?? [];
      if (offerErrors.some((issue) => issue.severity === 'error')) {
        records.push({
          offerId: offerId || '<missing>',
          classification: 'DATA_MISMATCH',
          action: 'reject',
          reasons: offerErrors.map((issue) => issue.code),
          rawHash: '',
          participantCount: 0,
          errors: offerErrors,
        });
        classification.DATA_MISMATCH += 1;
        continue;
      }

      const normalized = this.normalizer.normalize(sourceOffer);
      const result = this.classifier.classify(normalized);
      classification[result.classification] += 1;
      records.push(
        this.planRecord(
          normalized,
          result.classification,
          result.reasons,
          existing,
        ),
      );
    }

    return {
      tenantSlug: input.tenantSlug,
      tenantId: input.tenantId,
      sourceSystem: LEGACY_SOURCE_SYSTEM,
      sourceFilePath: input.sourceFilePath,
      sourceFileHash: input.sourceFileHash,
      mode: input.mode,
      fixtureOfferIds,
      batchSelection: input.batchSelection,
      counts: summarize(records),
      classification,
      duplicateLegacyIds,
      repeatedPolicyNumbers,
      records,
      errors: validationIssues,
    };
  }

  private planRecord(
    offer: NormalizedLegacyOffer,
    classification: LegacyOfferClassification,
    reasons: string[],
    existing: Map<string, ExistingImportMap>,
  ): LegacyImportPlanRecord {
    if (classification === 'DATA_MISMATCH') {
      return {
        offerId: offer.offerId,
        classification,
        action: 'reject',
        reasons,
        rawHash: offer.rawHash,
        participantCount: offer.participants.length,
        errors: [],
      };
    }
    if (classification === 'NEEDS_FINANCIAL_REVIEW') {
      return {
        offerId: offer.offerId,
        classification,
        action: 'review',
        reasons,
        rawHash: offer.rawHash,
        participantCount: offer.participants.length,
        errors: [],
      };
    }
    const existingPlacement = existing.get(`offer:${offer.offerId}`);
    if (!existingPlacement) {
      return {
        offerId: offer.offerId,
        classification,
        action: 'create',
        reasons,
        rawHash: offer.rawHash,
        participantCount: offer.participants.length,
        errors: [],
      };
    }
    if (existingPlacement.rawHash === offer.rawHash) {
      return {
        offerId: offer.offerId,
        classification,
        action: 'skip',
        reasons: ['legacy-import-map-match'],
        rawHash: offer.rawHash,
        currentPlacementId: existingPlacement.currentId,
        participantCount: offer.participants.length,
        errors: [],
      };
    }
    return {
      offerId: offer.offerId,
      classification,
      action: 'conflict',
      reasons: ['legacy-import-map-raw-hash-mismatch'],
      rawHash: offer.rawHash,
      currentPlacementId: existingPlacement.currentId,
      participantCount: offer.participants.length,
      errors: [],
    };
  }
}

function groupIssuesByOffer(issues: LegacyValidationIssue[]) {
  return issues.reduce((acc, issue) => {
    const key = issue.offerId ?? '<missing>';
    acc.set(key, [...(acc.get(key) ?? []), issue]);
    return acc;
  }, new Map<string, LegacyValidationIssue[]>());
}

function summarize(records: LegacyImportPlan['records']) {
  const creates: Record<string, number> = {
    currencies: 0,
    counterparties: 0,
    counterpartyAddresses: 0,
    riskClasses: 0,
    riskTypes: 0,
    riskTypeFields: 0,
    placements: 0,
    participants: 0,
    placementClosings: 0,
    legacyImportRuns: 1,
    legacyImportMaps: 0,
  };
  const summary = {
    creates,
    skips: 0,
    updates: 0,
    conflicts: 0,
    financialReview: 0,
    rejected: 0,
  };
  for (const record of records) {
    if (record.action === 'create') {
      const participantCount = record.participantCount ?? 0;
      creates.placements += 1;
      creates.participants += participantCount;
      creates.placementClosings += participantCount;
      creates.legacyImportMaps += 1 + participantCount + participantCount;
    }
    if (record.action === 'skip') summary.skips += 1;
    if (record.action === 'conflict') summary.conflicts += 1;
    if (record.action === 'review') summary.financialReview += 1;
    if (record.action === 'reject') summary.rejected += 1;
  }
  return summary;
}

function unmappedRiskClassIssues(
  offers: LegacyOffer[],
): LegacyValidationIssue[] {
  const issues: LegacyValidationIssue[] = [];
  offers.forEach((offer, index) => {
    const businessName = clean(offer.classofbusiness?.business_name);
    if (!businessName || resolveLegacyRiskClass(businessName)) return;
    const offerId = clean(offer.offer_id);
    issues.push({
      offerId: offerId ?? undefined,
      entityType: 'classofbusiness',
      legacyId: clean(offer.classofbusiness?.class_of_business_id) ?? undefined,
      severity: 'error',
      code: 'UNMAPPED_LEGACY_RISK_CLASS',
      message: `Legacy class of business '${businessName}' has no approved RiskClass mapping`,
      path: `offers.${index}.classofbusiness.business_name`,
      rawValue: businessName,
    });
  });
  return issues;
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'bigint'
  ) {
    return null;
  }
  const cleaned = String(value).trim();
  return cleaned.length > 0 ? cleaned : null;
}
