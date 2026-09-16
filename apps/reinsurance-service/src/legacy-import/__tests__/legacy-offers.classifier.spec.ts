import { LegacyOffersClassifier } from '../legacy-offers.classifier';
import { LegacyOffersNormalizer } from '../legacy-offers.normalizer';
import { LegacyOffer } from '../legacy-import.types';

describe('LegacyOffersClassifier', () => {
  const normalizer = new LegacyOffersNormalizer();
  const classifier = new LegacyOffersClassifier();

  it('classifies balanced unpaid records without deductions as AUTO_SAFE', () => {
    expect(
      classifier.classify(normalizer.normalize(offer())).classification,
    ).toBe('AUTO_SAFE');
  });

  it('classifies PAID records as NEEDS_FINANCIAL_REVIEW', () => {
    const result = classifier.classify(
      normalizer.normalize(offer({ payment_status: 'PAID' })),
    );
    expect(result.classification).toBe('NEEDS_FINANCIAL_REVIEW');
    expect(result.reasons).toContain('paid-payment-status');
  });

  it('classifies PARTPAYMENT records as NEEDS_FINANCIAL_REVIEW', () => {
    const result = classifier.classify(
      normalizer.normalize(offer({ payment_status: 'PARTPAYMENT' })),
    );
    expect(result.classification).toBe('NEEDS_FINANCIAL_REVIEW');
    expect(result.reasons).toContain('partpayment-payment-status');
  });

  it('classifies records with deductions as NEEDS_FINANCIAL_REVIEW', () => {
    const source = offer();
    source.offer_participant![0].offer_deduction_charge = {
      commission_taken: 1,
    };
    const result = classifier.classify(normalizer.normalize(source));
    expect(result.classification).toBe('NEEDS_FINANCIAL_REVIEW');
    expect(result.reasons).toContain('deduction-records-present');
  });

  it('classifies claims as NEEDS_FINANCIAL_REVIEW without creating claims yet', () => {
    const source = offer({
      claim_status: 'CLAIMED',
      offer_claims: [{ offer_claim_id: 'claim-1', claim_amount: 50 }],
    });
    const result = classifier.classify(normalizer.normalize(source));
    expect(result.classification).toBe('NEEDS_FINANCIAL_REVIEW');
    expect(result.reasons).toContain('claims-present');
  });

  it('treats offered-vs-placed rounding within 0.01 as AUTO_SAFE', () => {
    const result = classifier.classify(
      normalizer.normalize(
        offer({ facultative_offer: 20.009, placed_share: 20 }),
      ),
    );
    expect(result.classification).toBe('AUTO_SAFE');
  });

  it('classifies material offered-vs-placed delta as NEEDS_FINANCIAL_REVIEW', () => {
    const source = offer({ facultative_offer: 20, placed_share: 13.3 });
    source.offer_participant![0].offer_participant_percentage = 13.3;
    const result = classifier.classify(normalizer.normalize(source));
    expect(result.classification).toBe('NEEDS_FINANCIAL_REVIEW');
    expect(result.reasons).toContain(
      'material-facultative-offer-vs-placed-share-delta',
    );
  });

  it('keeps suspicious historical policy dates out of AUTO_SAFE batches', () => {
    const suspiciousDates = [
      {
        offer_detail: {
          policy_number: 'POL-293',
          insured_by: 'Insured One',
          currency: 'GHS',
          period_of_insurance_from: '0021-09-09',
          period_of_insurance_to: '2022-01-08',
          offer_details: '[{"keydetail":"Vehicle Make","value":"Truck"}]',
        },
        reason: 'suspicious-inception-date',
      },
      {
        offer_detail: {
          policy_number: 'POL-2254',
          insured_by: 'Insured One',
          currency: 'GHS',
          period_of_insurance_from: '2023-10-18',
          period_of_insurance_to: '2924-10-17',
          offer_details: '[{"keydetail":"Vehicle Make","value":"Truck"}]',
        },
        reason: 'suspicious-expiry-date',
      },
      {
        offer_detail: {
          policy_number: 'POL-1513',
          insured_by: 'Insured One',
          currency: 'GHS',
          period_of_insurance_from: '2023-02-08',
          period_of_insurance_to: '2034-02-07',
          offer_details: '[{"keydetail":"Vehicle Make","value":"Truck"}]',
        },
        reason: 'suspicious-expiry-date',
      },
    ];

    for (const { offer_detail, reason } of suspiciousDates) {
      const result = classifier.classify(
        normalizer.normalize(offer({ offer_detail })),
      );
      expect(result.classification).toBe('NEEDS_FINANCIAL_REVIEW');
      expect(result.reasons).toContain(reason);
    }
  });

  it('classifies hard participant arithmetic mismatch as DATA_MISMATCH', () => {
    const source = offer({ placed_share: 20, fac_premium: 200 });
    source.offer_participant![0].participant_fac_premium = 199.9;
    const result = classifier.classify(normalizer.normalize(source));
    expect(result.classification).toBe('DATA_MISMATCH');
    expect(result.reasons).toContain('participant-fac-premium-mismatch');
  });

  it('classifies nonpositive participant signed lines as DATA_MISMATCH', () => {
    const source = offer();
    source.offer_participant![0].offer_participant_percentage = 0;
    source.offer_participant![0].participant_fac_premium = 0;
    source.offer_participant![0].participant_fac_sum_insured = 0;
    source.offer_participant![0].offer_amount = 0;
    source.offer_participant![0].offer_extra_charges = {
      agreed_commission_amount: 0,
      agreed_brokerage_percentage: 0,
    };
    source.placed_share = 0;
    source.facultative_offer = 0;
    source.fac_premium = 0;
    source.fac_sum_insured = 0;
    source.commission_amount = 0;

    const result = classifier.classify(normalizer.normalize(source));

    expect(result.classification).toBe('DATA_MISMATCH');
    expect(result.reasons).toContain('nonpositive-participant-signed-line');
  });
});

function offer(overrides: Partial<LegacyOffer> = {}): LegacyOffer {
  return {
    offer_id: '1',
    offer_status: 'CLOSED',
    payment_status: 'UNPAID',
    claim_status: 'UNCLAIMED',
    created_at: '2026-09-08 08:50:34',
    sum_insured: 1000,
    premium: 100,
    rate: 10,
    commission: 20,
    commission_amount: 40,
    facultative_offer: 20,
    placed_share: 20,
    fac_premium: 200,
    fac_sum_insured: 2000,
    insurer: {
      insurer_id: 'cedant-1',
      insurer_company_name: 'Cedant One',
    },
    classofbusiness: {
      class_of_business_id: 'class-1',
      business_name: 'Motor',
      business_details: '[{"keydetail":"Vehicle Make"}]',
    },
    offer_detail: {
      policy_number: 'POL-1',
      insured_by: 'Insured One',
      currency: 'GHS',
      offer_details: '[{"keydetail":"Vehicle Make","value":"Truck"}]',
    },
    offer_participant: [
      {
        offer_participant_id: 'participant-1',
        offer_participant_percentage: 20,
        participant_fac_premium: 200,
        participant_fac_sum_insured: 2000,
        offer_extra_charges: {
          agreed_commission_amount: 40,
          agreed_brokerage_percentage: 5,
        },
        offer_deduction_charge: null,
        reinsurer: {
          reinsurer_id: 'reinsurer-1',
          re_company_name: 'Reinsurer One',
        },
      },
    ],
    offer_claims: [],
    offer_endorsements: [],
    ...overrides,
  };
}
