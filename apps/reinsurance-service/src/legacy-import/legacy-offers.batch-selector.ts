import {
  LegacyOffer,
  LegacyOfferClassification,
  NormalizedLegacyOffer,
} from './legacy-import.types';
import { LegacyOffersClassifier } from './legacy-offers.classifier';
import { LegacyOffersNormalizer } from './legacy-offers.normalizer';

export type LegacyBatchSelectionInput = {
  offers: LegacyOffer[];
  fixtureOfferIds?: string[];
  classification?: LegacyOfferClassification;
  batchSize?: number;
  afterOfferId?: string;
  referenceOnly?: boolean;
};

export type LegacyBatchSelection = {
  mode: 'fixture' | 'classification-batch' | 'reference-only' | 'all';
  selectedOfferIds: string[];
  selectedOffers: LegacyOffer[];
  normalizedOffers: NormalizedLegacyOffer[];
  classification?: LegacyOfferClassification;
  batchSize?: number;
  afterOfferId?: string;
};

const MAX_BATCH_SIZE = 250;

export function selectLegacyOffersForImport(
  input: LegacyBatchSelectionInput,
  normalizer = new LegacyOffersNormalizer(),
  classifier = new LegacyOffersClassifier(),
): LegacyBatchSelection {
  const fixtureOfferIds = input.fixtureOfferIds ?? [];
  validateBatchOptions(input);

  if (input.referenceOnly) {
    const normalizedOffers = input.offers
      .map((offer) => normalizer.normalize(offer))
      .filter(
        (offer) =>
          classifier.classify(offer).classification === input.classification,
      )
      .sort(compareNumericOfferIdDesc);
    return {
      mode: 'reference-only',
      selectedOfferIds: normalizedOffers.map((offer) => offer.offerId),
      selectedOffers: normalizedOffers.map((offer) => offer.source),
      normalizedOffers,
      classification: input.classification,
    };
  }

  if (fixtureOfferIds.length > 0) {
    const selectedOffers = input.offers.filter((offer) =>
      fixtureOfferIds.includes(String(offer.offer_id)),
    );
    const normalizedOffers = selectedOffers.map((offer) =>
      normalizer.normalize(offer),
    );
    return {
      mode: 'fixture',
      selectedOfferIds: normalizedOffers.map((offer) => offer.offerId),
      selectedOffers,
      normalizedOffers,
    };
  }

  if (input.classification) {
    const normalized = input.offers
      .map((offer) => normalizer.normalize(offer))
      .filter(
        (offer) =>
          classifier.classify(offer).classification === input.classification,
      )
      .sort(compareNumericOfferIdDesc);
    const filtered = input.afterOfferId
      ? normalized.filter(
          (offer) =>
            numericOfferId(offer.offerId) < numericOfferId(input.afterOfferId!),
        )
      : normalized;
    const normalizedOffers = filtered.slice(0, input.batchSize);
    return {
      mode: 'classification-batch',
      selectedOfferIds: normalizedOffers.map((offer) => offer.offerId),
      selectedOffers: normalizedOffers.map((offer) => offer.source),
      normalizedOffers,
      classification: input.classification,
      batchSize: input.batchSize,
      afterOfferId: input.afterOfferId,
    };
  }

  const normalizedOffers = input.offers.map((offer) =>
    normalizer.normalize(offer),
  );
  return {
    mode: 'all',
    selectedOfferIds: normalizedOffers.map((offer) => offer.offerId),
    selectedOffers: input.offers,
    normalizedOffers,
  };
}

export function validateApplySelection(selection: LegacyBatchSelection): void {
  if (selection.mode === 'reference-only') {
    if (selection.selectedOfferIds.length === 0) {
      throw new Error('Apply selection is empty.');
    }
    return;
  }
  if (selection.mode === 'all') {
    throw new Error(
      'Apply requires --fixture or --classification AUTO_SAFE with --batch-size.',
    );
  }
  if (
    selection.mode === 'classification-batch' &&
    selection.classification !== 'AUTO_SAFE'
  ) {
    throw new Error('Batch apply supports only --classification AUTO_SAFE.');
  }
  if (selection.selectedOfferIds.length === 0) {
    throw new Error('Apply selection is empty.');
  }
}

function validateBatchOptions(input: LegacyBatchSelectionInput): void {
  const fixtureOfferIds = input.fixtureOfferIds ?? [];
  if (input.referenceOnly) {
    if (fixtureOfferIds.length > 0 || input.batchSize || input.afterOfferId) {
      throw new Error(
        '--reference-only cannot be combined with --fixture, --batch-size, or --after-offer-id.',
      );
    }
    if (input.classification !== 'AUTO_SAFE') {
      throw new Error(
        '--reference-only requires --classification AUTO_SAFE for Phase 1.',
      );
    }
    return;
  }
  if (fixtureOfferIds.length > 0) {
    if (input.classification || input.batchSize || input.afterOfferId) {
      throw new Error(
        '--fixture cannot be combined with --classification, --batch-size, or --after-offer-id.',
      );
    }
    return;
  }
  if (!input.classification && (input.batchSize || input.afterOfferId)) {
    throw new Error(
      '--batch-size and --after-offer-id require --classification.',
    );
  }
  if (!input.classification) return;
  if (input.classification !== 'AUTO_SAFE') {
    throw new Error(
      'Batch selection supports only --classification AUTO_SAFE.',
    );
  }
  if (!input.batchSize) {
    throw new Error('--classification requires --batch-size.');
  }
  if (!Number.isInteger(input.batchSize) || input.batchSize < 1) {
    throw new Error('--batch-size must be a positive integer.');
  }
  if (input.batchSize > MAX_BATCH_SIZE) {
    throw new Error(`--batch-size must be <= ${MAX_BATCH_SIZE}.`);
  }
  if (input.afterOfferId) numericOfferId(input.afterOfferId);
}

function compareNumericOfferIdDesc(
  left: NormalizedLegacyOffer,
  right: NormalizedLegacyOffer,
) {
  return numericOfferId(right.offerId) - numericOfferId(left.offerId);
}

function numericOfferId(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Legacy offer_id '${value}' is not a numeric cursor.`);
  }
  return parsed;
}
