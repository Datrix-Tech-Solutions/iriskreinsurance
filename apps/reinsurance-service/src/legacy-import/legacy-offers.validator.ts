import { LegacyOffer, LegacyValidationIssue } from './legacy-import.types';

export class LegacyOffersValidator {
  validate(offers: LegacyOffer[]): LegacyValidationIssue[] {
    return [
      ...this.requiredFieldIssues(offers),
      ...this.malformedJsonIssues(offers),
      ...this.duplicateIdIssues(offers),
    ];
  }

  repeatedPolicyNumbers(offers: LegacyOffer[]) {
    const byPolicy = new Map<string, string[]>();
    for (const offer of offers) {
      const policyNumber = clean(offer.offer_detail?.policy_number);
      if (!policyNumber) continue;
      const offerId = clean(offer.offer_id) ?? '<missing>';
      byPolicy.set(policyNumber, [
        ...(byPolicy.get(policyNumber) ?? []),
        offerId,
      ]);
    }
    return [...byPolicy.entries()]
      .filter(([, offerIds]) => new Set(offerIds).size > 1)
      .map(([policyNumber, offerIds]) => ({
        policyNumber,
        offerIds: [...new Set(offerIds)],
      }));
  }

  private requiredFieldIssues(offers: LegacyOffer[]): LegacyValidationIssue[] {
    const issues: LegacyValidationIssue[] = [];
    offers.forEach((offer, index) => {
      const offerId = clean(offer.offer_id);
      this.require(
        issues,
        offerId,
        offerId,
        'offer',
        'offer_id',
        offer.offer_id,
        index,
      );
      this.require(
        issues,
        offerId,
        clean(offer.insurer?.insurer_id),
        'insurer',
        'insurer.insurer_id',
        offer.insurer?.insurer_id,
        index,
      );
      this.require(
        issues,
        offerId,
        clean(offer.insurer?.insurer_company_name),
        'insurer',
        'insurer.insurer_company_name',
        offer.insurer?.insurer_company_name,
        index,
      );
      this.require(
        issues,
        offerId,
        clean(offer.classofbusiness?.class_of_business_id),
        'classofbusiness',
        'classofbusiness.class_of_business_id',
        offer.classofbusiness?.class_of_business_id,
        index,
      );
      this.require(
        issues,
        offerId,
        clean(offer.classofbusiness?.business_name),
        'classofbusiness',
        'classofbusiness.business_name',
        offer.classofbusiness?.business_name,
        index,
      );
      this.require(
        issues,
        offerId,
        clean(offer.offer_detail?.policy_number),
        'offer_detail',
        'offer_detail.policy_number',
        offer.offer_detail?.policy_number,
        index,
      );
      this.require(
        issues,
        offerId,
        clean(offer.offer_detail?.insured_by),
        'offer_detail',
        'offer_detail.insured_by',
        offer.offer_detail?.insured_by,
        index,
      );
      this.require(
        issues,
        offerId,
        clean(offer.offer_detail?.currency),
        'offer_detail',
        'offer_detail.currency',
        offer.offer_detail?.currency,
        index,
      );

      (offer.offer_participant ?? []).forEach(
        (participant, participantIndex) => {
          const participantPath = `offer_participant.${participantIndex}`;
          this.require(
            issues,
            offerId,
            clean(participant.offer_participant_id),
            'offer_participant',
            `${participantPath}.offer_participant_id`,
            participant.offer_participant_id,
            index,
          );
          this.require(
            issues,
            offerId,
            clean(participant.reinsurer?.reinsurer_id),
            'reinsurer',
            `${participantPath}.reinsurer.reinsurer_id`,
            participant.reinsurer?.reinsurer_id,
            index,
          );
          this.require(
            issues,
            offerId,
            clean(participant.reinsurer?.re_company_name),
            'reinsurer',
            `${participantPath}.reinsurer.re_company_name`,
            participant.reinsurer?.re_company_name,
            index,
          );
        },
      );
    });
    return issues;
  }

  private malformedJsonIssues(offers: LegacyOffer[]): LegacyValidationIssue[] {
    const issues: LegacyValidationIssue[] = [];
    offers.forEach((offer, index) => {
      this.assertJsonArray(
        issues,
        clean(offer.offer_id),
        'classofbusiness',
        'classofbusiness.business_details',
        offer.classofbusiness?.business_details,
        index,
      );
      this.assertJsonArray(
        issues,
        clean(offer.offer_id),
        'offer_detail',
        'offer_detail.offer_details',
        offer.offer_detail?.offer_details,
        index,
      );
    });
    return issues;
  }

  private duplicateIdIssues(offers: LegacyOffer[]): LegacyValidationIssue[] {
    return [
      ...duplicates(
        offers
          .map((offer) => clean(offer.offer_id))
          .filter(Boolean) as string[],
        'offer',
        'offer_id',
      ),
      ...duplicates(
        offers.flatMap((offer) =>
          (offer.offer_participant ?? [])
            .map((participant) => clean(participant.offer_participant_id))
            .filter(Boolean),
        ) as string[],
        'offer_participant',
        'offer_participant.offer_participant_id',
      ),
    ];
  }

  private require(
    issues: LegacyValidationIssue[],
    offerId: string | null,
    cleanedValue: string | null,
    entityType: string,
    path: string,
    rawValue: unknown,
    index: number,
  ) {
    if (cleanedValue) return;
    issues.push({
      offerId: offerId ?? undefined,
      entityType,
      legacyId: offerId ?? undefined,
      severity: 'error',
      code: 'MISSING_REQUIRED_FIELD',
      message: `Missing required legacy field '${path}'`,
      path: `offers.${index}.${path}`,
      rawValue,
    });
  }

  private assertJsonArray(
    issues: LegacyValidationIssue[],
    offerId: string | null,
    entityType: string,
    path: string,
    rawValue: string | null | undefined,
    index: number,
  ) {
    if (!rawValue) return;
    try {
      const parsed = JSON.parse(rawValue) as unknown;
      if (!Array.isArray(parsed)) throw new Error('not an array');
    } catch {
      issues.push({
        offerId: offerId ?? undefined,
        entityType,
        legacyId: offerId ?? undefined,
        severity: 'error',
        code: 'MALFORMED_JSON',
        message: `Expected '${path}' to be a JSON array`,
        path: `offers.${index}.${path}`,
        rawValue,
      });
    }
  }
}

function duplicates(ids: string[], entityType: string, path: string) {
  const counts = ids.reduce((acc, id) => {
    acc.set(id, (acc.get(id) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(
      ([id, count]): LegacyValidationIssue => ({
        entityType,
        legacyId: id,
        severity: 'error',
        code: 'DUPLICATE_LEGACY_ID',
        message: `Duplicate legacy ${entityType} id '${id}' appears ${count} times`,
        path,
        rawValue: id,
      }),
    );
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
