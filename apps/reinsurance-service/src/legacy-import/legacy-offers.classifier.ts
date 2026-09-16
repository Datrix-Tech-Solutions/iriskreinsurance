import {
  LegacyClassificationResult,
  NormalizedLegacyOffer,
} from './legacy-import.types';
import { LegacyDecimal } from './legacy-decimal';
import { LegacyOffersReconciler } from './legacy-offers.reconciler';

export class LegacyOffersClassifier {
  constructor(private readonly reconciler = new LegacyOffersReconciler()) {}

  classify(offer: NormalizedLegacyOffer): LegacyClassificationResult {
    const reconciliation = this.reconciler.reconcile(offer);
    const hardMismatchReasons = hardMismatchReasonsFor(
      offer,
      reconciliation.mismatches,
    );
    if (hardMismatchReasons.length > 0) {
      return {
        offerId: offer.offerId,
        classification: 'DATA_MISMATCH',
        reasons: hardMismatchReasons,
        reconciliation,
      };
    }

    const reviewReasons = reviewReasonsFor(offer, reconciliation);
    if (reviewReasons.length > 0) {
      return {
        offerId: offer.offerId,
        classification: 'NEEDS_FINANCIAL_REVIEW',
        reasons: reviewReasons,
        reconciliation,
      };
    }

    return {
      offerId: offer.offerId,
      classification: 'AUTO_SAFE',
      reasons: [
        'balanced-no-claims-no-endorsements-no-deductions-not-paid-no-material-offered-vs-placed-delta',
      ],
      reconciliation,
    };
  }
}

function hardMismatchReasonsFor(
  offer: NormalizedLegacyOffer,
  mismatches: LegacyClassificationResult['reconciliation']['mismatches'],
) {
  const reasons: string[] = [];
  if (
    offer.participants.some(
      (participant) =>
        !LegacyDecimal.from(participant.percentage).gt(LegacyDecimal.zero()),
    )
  ) {
    reasons.push('nonpositive-participant-signed-line');
  }
  if (mismatches.percentage) reasons.push('participant-percentage-mismatch');
  if (mismatches.facPremium) reasons.push('participant-fac-premium-mismatch');
  if (mismatches.facSumInsured) {
    reasons.push('participant-fac-sum-insured-mismatch');
  }
  if (mismatches.commissionAmount) {
    reasons.push('participant-commission-amount-mismatch');
  }
  return reasons;
}

function reviewReasonsFor(
  offer: NormalizedLegacyOffer,
  reconciliation: LegacyClassificationResult['reconciliation'],
) {
  const reasons: string[] = [];
  if (offer.paymentStatus === 'PAID') reasons.push('paid-payment-status');
  if (offer.paymentStatus === 'PARTPAYMENT') {
    reasons.push('partpayment-payment-status');
  }
  if (offer.participants.some((participant) => participant.hasDeduction)) {
    reasons.push('deduction-records-present');
  }
  if (offer.claims.length > 0) reasons.push('claims-present');
  if (offer.endorsements.length > 0) reasons.push('endorsements-present');
  if (reconciliation.mismatches.materialOfferedVsPlaced) {
    reasons.push('material-facultative-offer-vs-placed-share-delta');
  }
  reasons.push(...suspiciousDateReasonsFor(offer));
  return reasons;
}

function suspiciousDateReasonsFor(offer: NormalizedLegacyOffer) {
  const reasons: string[] = [];
  if (isSuspiciousLegacyPolicyDate(offer.inceptionDate)) {
    reasons.push('suspicious-inception-date');
  }
  if (isSuspiciousLegacyPolicyDate(offer.expiryDate)) {
    reasons.push('suspicious-expiry-date');
  }
  return reasons;
}

function isSuspiciousLegacyPolicyDate(value: Date | null) {
  if (!value) return false;
  const year = value.getUTCFullYear();
  return year < 2000 || year > 2030;
}
