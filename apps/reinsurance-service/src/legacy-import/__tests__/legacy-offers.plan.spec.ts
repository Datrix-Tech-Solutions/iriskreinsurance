import { LegacyOffersPlanGenerator } from '../legacy-offers.plan';
import { sha256 } from '../legacy-hash';
import { LegacyOffer } from '../legacy-import.types';

describe('LegacyOffersPlanGenerator', () => {
  const generator = new LegacyOffersPlanGenerator();

  it('plans idempotent skips when import map hash matches', () => {
    const plan = generator.build({
      tenantSlug: 'acme-ghana',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      mode: 'dry-run',
      offers: [offer()],
      existingMaps: [
        {
          entityType: 'offer',
          legacyId: '1',
          currentModel: 'Placement',
          currentId: 'placement-1',
          rawHash: planHashFor(offer()),
        },
      ],
    });
    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        offerId: '1',
        action: 'skip',
        currentPlacementId: 'placement-1',
      }),
    );
    expect(plan.counts.skips).toBe(1);
  });

  it('plans conflicts when import map hash differs', () => {
    const plan = generator.build({
      tenantSlug: 'acme-ghana',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      mode: 'dry-run',
      offers: [offer()],
      existingMaps: [
        {
          entityType: 'offer',
          legacyId: '1',
          currentModel: 'Placement',
          currentId: 'placement-1',
          rawHash: 'different',
        },
      ],
    });
    expect(plan.records[0].action).toBe('conflict');
    expect(plan.counts.conflicts).toBe(1);
  });

  it('fails closed for unmapped legacy classes', () => {
    const plan = generator.build({
      tenantSlug: 'acme-ghana',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      mode: 'dry-run',
      offers: [
        offer({
          classofbusiness: {
            class_of_business_id: '999',
            business_name: 'Mystery Risk',
            business_details: '[]',
          },
        }),
      ],
    });

    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        classification: 'DATA_MISMATCH',
        action: 'reject',
        reasons: ['UNMAPPED_LEGACY_RISK_CLASS'],
      }),
    );
    expect(plan.errors).toEqual([
      expect.objectContaining({
        code: 'UNMAPPED_LEGACY_RISK_CLASS',
        severity: 'error',
        rawValue: 'Mystery Risk',
      }),
    ]);
  });
});

function planHashFor(source: LegacyOffer) {
  return sha256(source);
}

function offer(overrides: Partial<LegacyOffer> = {}): LegacyOffer {
  return {
    offer_id: '1',
    offer_status: 'CLOSED',
    payment_status: 'UNPAID',
    claim_status: 'UNCLAIMED',
    sum_insured: 1000,
    premium: 100,
    commission_amount: 20,
    facultative_offer: 20,
    placed_share: 20,
    fac_premium: 200,
    fac_sum_insured: 200,
    insurer: { insurer_id: '15', insurer_company_name: 'Cedant' },
    classofbusiness: {
      class_of_business_id: '1',
      business_name: 'Motor',
      business_details: '[]',
    },
    offer_detail: {
      policy_number: 'POL-1',
      insured_by: 'Insured',
      currency: 'GHS',
      offer_details: '[]',
    },
    offer_participant: [
      {
        offer_participant_id: 'p1',
        offer_participant_percentage: 20,
        participant_fac_premium: 200,
        participant_fac_sum_insured: 200,
        offer_extra_charges: { agreed_commission_amount: 20 },
        reinsurer: { reinsurer_id: 'r1', re_company_name: 'Reinsurer' },
      },
    ],
    ...overrides,
  };
}
