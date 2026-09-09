import { LegacyDecimal } from './legacy-decimal';
import { sha256 } from './legacy-hash';
import {
  LegacyOffer,
  LegacyRiskField,
  NormalizedLegacyOffer,
  NormalizedLegacyParticipant,
} from './legacy-import.types';

export class LegacyOffersNormalizer {
  normalize(offer: LegacyOffer): NormalizedLegacyOffer {
    const detail = offer.offer_detail ?? {};
    const classOfBusiness = offer.classofbusiness ?? {};
    const insurer = offer.insurer ?? {};
    const offerId = cleanRequired(offer.offer_id, 'offer_id');
    const policyNumber = cleanRequired(detail.policy_number, 'policy_number');
    const title = cleanRequired(detail.insured_by, 'insured_by');
    const classId = cleanRequired(
      classOfBusiness.class_of_business_id,
      'classofbusiness.class_of_business_id',
    );
    const className = cleanRequired(
      classOfBusiness.business_name,
      'classofbusiness.business_name',
    );
    const insurerId = cleanRequired(insurer.insurer_id, 'insurer.insurer_id');
    const insurerName = cleanRequired(
      insurer.insurer_company_name,
      'insurer.insurer_company_name',
    );

    return {
      source: offer,
      rawHash: sha256(offer),
      offerId,
      reference: `LEGACY-OFFER-${offerId}`,
      normalizedReference: `legacy-offer-${offerId}`,
      policyNumber,
      title,
      currency: cleanRequired(
        detail.currency,
        'offer_detail.currency',
      ).toUpperCase(),
      offerStatus: cleanOptional(offer.offer_status) ?? 'UNKNOWN',
      paymentStatus: cleanOptional(offer.payment_status) ?? 'UNKNOWN',
      claimStatus: cleanOptional(offer.claim_status) ?? 'UNKNOWN',
      classId,
      className,
      insurerId,
      insurerName,
      inceptionDate: parseDate(detail.period_of_insurance_from),
      expiryDate: parseDate(detail.period_of_insurance_to),
      numbers: {
        sumInsured: decimalString(offer.sum_insured),
        premium: decimalString(offer.premium),
        rate: cleanOptional(offer.rate) ? decimalString(offer.rate) : null,
        commission: cleanOptional(offer.commission)
          ? decimalString(offer.commission)
          : null,
        commissionAmount: decimalString(offer.commission_amount),
        facultativeOffer: decimalString(offer.facultative_offer),
        placedShare: decimalString(offer.placed_share),
        facPremium: decimalString(offer.fac_premium),
        facSumInsured: decimalString(offer.fac_sum_insured),
      },
      businessFields: parseRiskFields(classOfBusiness.business_details, false),
      offerFields: parseRiskFields(detail.offer_details, true),
      participants: (offer.offer_participant ?? []).map((participant) =>
        this.normalizeParticipant(participant),
      ),
      claims: offer.offer_claims ?? [],
      endorsements: offer.offer_endorsements ?? [],
    };
  }

  private normalizeParticipant(
    participant: NonNullable<LegacyOffer['offer_participant']>[number],
  ): NormalizedLegacyParticipant {
    const reinsurer = participant.reinsurer ?? {};
    return {
      source: participant,
      rawHash: sha256(participant),
      participantId: cleanRequired(
        participant.offer_participant_id,
        'offer_participant.offer_participant_id',
      ),
      reinsurerId: cleanRequired(
        reinsurer.reinsurer_id,
        'reinsurer.reinsurer_id',
      ),
      reinsurerName: cleanRequired(
        reinsurer.re_company_name,
        'reinsurer.re_company_name',
      ),
      percentage: decimalString(participant.offer_participant_percentage),
      offerAmount: decimalString(participant.offer_amount),
      facPremium: decimalString(participant.participant_fac_premium),
      facSumInsured: decimalString(participant.participant_fac_sum_insured),
      hasDeduction: participant.offer_deduction_charge != null,
      brokerageFee: cleanOptional(
        participant.offer_extra_charges?.agreed_brokerage_percentage,
      )
        ? decimalString(
            participant.offer_extra_charges?.agreed_brokerage_percentage,
          )
        : null,
    };
  }
}

export function normalizeFieldKey(key: string): string {
  return key
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseRiskFields(
  raw: string | null | undefined,
  includeValues: boolean,
) {
  const parsed = parseJsonArray(raw);
  return parsed
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object'),
    )
    .map((item) => {
      const key = cleanOptional(item.keydetail) ?? 'unknown';
      const field: LegacyRiskField = {
        key,
        normalizedKey: normalizeFieldKey(key),
      };
      if (includeValues) field.value = item.value;
      return field;
    })
    .filter((field) => field.normalizedKey.length > 0);
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

function parseDate(value: string | null | undefined): Date | null {
  const cleaned = cleanOptional(value);
  if (!cleaned) return null;
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function decimalString(value: unknown): string {
  return LegacyDecimal.from(value).toString();
}

function cleanOptional(value: unknown): string | null {
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

function cleanRequired(value: unknown, path: string): string {
  const cleaned = cleanOptional(value);
  if (!cleaned) throw new Error(`Missing required legacy field: ${path}`);
  return cleaned;
}
