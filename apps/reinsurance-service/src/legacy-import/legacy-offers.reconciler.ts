import { LegacyDecimal, sumDecimals } from './legacy-decimal';
import {
  LEGACY_TOLERANCES,
  LegacyFinancialReconciliation,
  NormalizedLegacyOffer,
} from './legacy-import.types';

export class LegacyOffersReconciler {
  reconcile(offer: NormalizedLegacyOffer): LegacyFinancialReconciliation {
    const participantPercentage = sumDecimals(
      offer.participants.map((participant) => participant.percentage),
    );
    const participantFacPremium = sumDecimals(
      offer.participants.map((participant) => participant.facPremium),
    );
    const participantFacSumInsured = sumDecimals(
      offer.participants.map((participant) => participant.facSumInsured),
    );
    const participantCommissionAmount = sumDecimals(
      offer.participants.map(
        (participant) =>
          participant.source.offer_extra_charges?.agreed_commission_amount,
      ),
    );

    const placedShare = LegacyDecimal.from(offer.numbers.placedShare);
    const facPremium = LegacyDecimal.from(offer.numbers.facPremium);
    const facSumInsured = LegacyDecimal.from(offer.numbers.facSumInsured);
    const commissionAmount = LegacyDecimal.from(offer.numbers.commissionAmount);
    const facultativeOffer = LegacyDecimal.from(offer.numbers.facultativeOffer);

    const percentageDelta = participantPercentage.subtract(placedShare).abs();
    const facPremiumDelta = participantFacPremium.subtract(facPremium).abs();
    const facSumInsuredDelta = participantFacSumInsured
      .subtract(facSumInsured)
      .abs();
    const commissionDelta = participantCommissionAmount
      .subtract(commissionAmount)
      .abs();
    const offeredVsPlacedDelta = facultativeOffer.subtract(placedShare).abs();

    return {
      offerId: offer.offerId,
      sums: {
        participantPercentage: participantPercentage.toString(),
        placedShare: placedShare.toString(),
        participantFacPremium: participantFacPremium.toString(),
        facPremium: facPremium.toString(),
        participantFacSumInsured: participantFacSumInsured.toString(),
        facSumInsured: facSumInsured.toString(),
        participantCommissionAmount: participantCommissionAmount.toString(),
        commissionAmount: commissionAmount.toString(),
        facultativeOffer: facultativeOffer.toString(),
      },
      deltas: {
        participantPercentageVsPlacedShare: percentageDelta.toString(),
        participantFacPremiumVsFacPremium: facPremiumDelta.toString(),
        participantFacSumInsuredVsFacSumInsured: facSumInsuredDelta.toString(),
        participantCommissionVsCommissionAmount: commissionDelta.toString(),
        facultativeOfferVsPlacedShare: offeredVsPlacedDelta.toString(),
      },
      mismatches: {
        percentage: percentageDelta.gt(
          LegacyDecimal.from(LEGACY_TOLERANCES.percentage),
        ),
        facPremium: facPremiumDelta.gt(
          LegacyDecimal.from(LEGACY_TOLERANCES.money),
        ),
        facSumInsured: facSumInsuredDelta.gt(
          LegacyDecimal.from(LEGACY_TOLERANCES.sumInsured),
        ),
        commissionAmount: commissionDelta.gt(
          LegacyDecimal.from(LEGACY_TOLERANCES.money),
        ),
        materialOfferedVsPlaced: offeredVsPlacedDelta.gt(
          LegacyDecimal.from(LEGACY_TOLERANCES.offeredVsPlaced),
        ),
      },
    };
  }
}
