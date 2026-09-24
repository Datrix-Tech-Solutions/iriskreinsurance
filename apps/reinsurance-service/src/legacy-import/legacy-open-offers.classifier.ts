import { LegacyDecimal } from './legacy-decimal';
import { LegacyOffersClassifier } from './legacy-offers.classifier';
import {
  LegacyClassificationResult,
  NormalizedLegacyOffer,
} from './legacy-import.types';

export function classifyOpenOffer(
  offer: NormalizedLegacyOffer,
): LegacyClassificationResult {
  const closedResult = new LegacyOffersClassifier().classify(offer);
  const reasons: string[] = [];
  if (offer.offerStatus !== 'OPEN' && offer.offerStatus !== 'PENDING') {
    reasons.push('non-open-offer-status');
  }
  if (offer.paymentStatus !== 'UNPAID') {
    reasons.push('open-offer-payment-status-not-unpaid');
  }
  if (
    offer.participants.some(
      (participant) =>
        !LegacyDecimal.from(participant.percentage).gt(LegacyDecimal.zero()),
    )
  ) {
    reasons.push('nonpositive-participant-signed-line');
  }
  if (reasons.length > 0) {
    return {
      offerId: offer.offerId,
      classification: 'DATA_MISMATCH',
      reasons,
      reconciliation: closedResult.reconciliation,
    };
  }
  return {
    offerId: offer.offerId,
    classification: 'AUTO_SAFE',
    reasons: ['open-offer-placement-only-no-historical-financials'],
    reconciliation: closedResult.reconciliation,
  };
}
