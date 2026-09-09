import { LegacyOffersValidator } from '../legacy-offers.validator';
import { LegacyOffer } from '../legacy-import.types';

describe('LegacyOffersValidator', () => {
  const validator = new LegacyOffersValidator();

  it('reports malformed nested JSON', () => {
    const issues = validator.validate([
      offer({ offer_detail: { ...baseDetail(), offer_details: '{bad' } }),
    ]);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MALFORMED_JSON' }),
      ]),
    );
  });

  it('reports duplicate offer and participant legacy IDs', () => {
    const issues = validator.validate([offer(), offer()]);
    expect(
      issues.filter((issue) => issue.code === 'DUPLICATE_LEGACY_ID'),
    ).toHaveLength(2);
  });

  it('allows repeated policy numbers as warnings outside duplicate legacy IDs', () => {
    const repeated = validator.repeatedPolicyNumbers([
      offer({ offer_id: '1' }),
      offer({ offer_id: '2' }),
    ]);
    expect(repeated).toEqual([{ policyNumber: 'POL-1', offerIds: ['1', '2'] }]);
    expect(
      validator.validate([
        offer({ offer_id: '1' }),
        offer({
          offer_id: '2',
          offer_participant: [
            {
              offer_participant_id: 'p2',
              reinsurer: { reinsurer_id: 'r1', re_company_name: 'Reinsurer' },
            },
          ],
        }),
      ]),
    ).toEqual([]);
  });
});

function baseDetail() {
  return {
    policy_number: 'POL-1',
    insured_by: 'Insured',
    currency: 'GHS',
    offer_details: '[]',
  };
}

function offer(overrides: Partial<LegacyOffer> = {}): LegacyOffer {
  return {
    offer_id: '1',
    insurer: { insurer_id: '15', insurer_company_name: 'Cedant' },
    classofbusiness: {
      class_of_business_id: '1',
      business_name: 'Motor',
      business_details: '[]',
    },
    offer_detail: baseDetail(),
    offer_participant: [
      {
        offer_participant_id: 'p1',
        reinsurer: { reinsurer_id: 'r1', re_company_name: 'Reinsurer' },
      },
    ],
    ...overrides,
  };
}
