import { LegacyOffersNormalizer } from '../legacy-offers.normalizer';
import { LegacyOffersReconciler } from '../legacy-offers.reconciler';
import { LegacyOffer } from '../legacy-import.types';

describe('LegacyOffersReconciler', () => {
  const normalizer = new LegacyOffersNormalizer();
  const reconciler = new LegacyOffersReconciler();

  it('reconciles participant totals with decimal arithmetic', () => {
    const result = reconciler.reconcile(normalizer.normalize(offer()));
    expect(result.sums.participantPercentage).toBe('33.33');
    expect(result.sums.placedShare).toBe('33.33');
    expect(result.mismatches.percentage).toBe(false);
    expect(result.mismatches.facPremium).toBe(false);
    expect(result.mismatches.facSumInsured).toBe(false);
  });

  it('flags financial mismatches beyond tolerance', () => {
    const source = offer({ fac_premium: 797.71920228 });
    const result = reconciler.reconcile(normalizer.normalize(source));
    expect(result.mismatches.facPremium).toBe(true);
    expect(result.deltas.participantFacPremiumVsFacPremium).toBe('0.07897428');
  });
});

function offer(overrides: Partial<LegacyOffer> = {}): LegacyOffer {
  return {
    offer_id: '3',
    offer_status: 'CLOSED',
    payment_status: 'UNPAID',
    claim_status: 'UNCLAIMED',
    created_at: '2026-09-08 08:50:34',
    sum_insured: 60000,
    premium: 2393.16,
    commission_amount: 171.49264902,
    facultative_offer: 33.33,
    placed_share: 33.33,
    fac_premium: 797.640228,
    fac_sum_insured: 19998,
    insurer: { insurer_id: '15', insurer_company_name: 'Cedant' },
    classofbusiness: {
      class_of_business_id: '1',
      business_name: 'Motor Comprehensive',
      business_details: '[]',
    },
    offer_detail: {
      policy_number: 'POL-3',
      insured_by: 'Insured',
      currency: 'GHS',
      offer_details: '[]',
    },
    offer_participant: [
      {
        offer_participant_id: 'p3',
        offer_participant_percentage: 33.33,
        participant_fac_premium: 797.640228,
        participant_fac_sum_insured: 19998,
        offer_extra_charges: { agreed_commission_amount: 171.49264902 },
        reinsurer: { reinsurer_id: '1', re_company_name: 'Reinsurer' },
      },
    ],
    ...overrides,
  };
}
