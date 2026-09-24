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

  it('makes financially resolved NEEDS_FINANCIAL_REVIEW offers scoped-eligible without relabeling classification', () => {
    const paidOffer = offer({ payment_status: 'PAID' });
    const plan = generator.build({
      tenantSlug: 'acme-ghana',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      mode: 'dry-run',
      offers: [paidOffer],
      scopedFinancialResolvedOfferIds: new Set(['1']),
    });

    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        offerId: '1',
        classification: 'NEEDS_FINANCIAL_REVIEW',
        scopedEligibility: 'SCOPED_FINANCIAL_RESOLVED',
        action: 'create',
      }),
    );
    expect(plan.records[0]?.reasons).toEqual(
      expect.arrayContaining([
        'scoped-financial-resolved',
        'paid-payment-status',
      ]),
    );
    expect(plan.counts.creates.placements).toBe(1);
  });

  it('plans open-offer imports without historical closing rows or maps', () => {
    const plan = generator.build({
      tenantSlug: 'stellar-tech',
      sourceFilePath: 'legacy-offers-open-2026.json',
      sourceFileHash: 'file-hash',
      mode: 'dry-run',
      offerLifecycle: 'open',
      offers: [offer({ offer_status: 'OPEN' })],
    });

    expect(plan.offerLifecycle).toBe('open');
    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        offerId: '1',
        action: 'create',
        participantCount: 1,
      }),
    );
    expect(plan.counts.creates.placements).toBe(1);
    expect(plan.counts.creates.participants).toBe(1);
    expect(plan.counts.creates.placementClosings).toBe(0);
    expect(plan.counts.creates.legacyImportMaps).toBe(2);
  });

  it('allows open-offer placement-only records with no participants', () => {
    const plan = generator.build({
      tenantSlug: 'stellar-tech',
      sourceFilePath: 'legacy-offers-open-2026.json',
      sourceFileHash: 'file-hash',
      mode: 'dry-run',
      offerLifecycle: 'open',
      offers: [
        offer({
          offer_status: 'OPEN',
          placed_share: null,
          offer_participant: [],
        }),
      ],
    });

    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        classification: 'AUTO_SAFE',
        action: 'create',
        participantCount: 0,
        reasons: ['open-offer-placement-only-no-historical-financials'],
      }),
    );
    expect(plan.counts.creates.placements).toBe(1);
    expect(plan.counts.creates.participants).toBe(0);
    expect(plan.counts.creates.placementClosings).toBe(0);
    expect(plan.counts.creates.legacyImportMaps).toBe(1);
  });

  it('keeps open-offer rows with nonpositive participant signed lines hard blocked', () => {
    const source = offer({ offer_status: 'OPEN' });
    source.offer_participant![0].offer_participant_percentage = 0;
    const plan = generator.build({
      tenantSlug: 'stellar-tech',
      sourceFilePath: 'legacy-offers-open-2026.json',
      sourceFileHash: 'file-hash',
      mode: 'dry-run',
      offerLifecycle: 'open',
      offers: [source],
    });

    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        classification: 'DATA_MISMATCH',
        action: 'reject',
        reasons: ['nonpositive-participant-signed-line'],
      }),
    );
    expect(plan.counts.rejected).toBe(1);
    expect(plan.counts.creates.placements).toBe(0);
  });

  it('keeps financially unresolved NEEDS_FINANCIAL_REVIEW offers entirely blocked', () => {
    const plan = generator.build({
      tenantSlug: 'acme-ghana',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      mode: 'dry-run',
      offers: [offer({ payment_status: 'PAID' })],
    });

    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        classification: 'NEEDS_FINANCIAL_REVIEW',
        scopedEligibility: 'FINANCIAL_UNRESOLVED',
        action: 'review',
      }),
    );
    expect(plan.counts.financialReview).toBe(1);
    expect(plan.counts.creates.placements).toBe(0);
  });

  it('keeps DATA_MISMATCH offers entirely blocked even if passed as scoped financial resolved', () => {
    const source = offer();
    source.offer_participant![0].offer_participant_percentage = 0;
    source.offer_participant![0].participant_fac_premium = 0;
    source.offer_participant![0].participant_fac_sum_insured = 0;
    source.placed_share = 0;
    source.fac_premium = 0;
    source.fac_sum_insured = 0;
    source.commission_amount = 0;
    const plan = generator.build({
      tenantSlug: 'acme-ghana',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      mode: 'dry-run',
      offers: [source],
      scopedFinancialResolvedOfferIds: new Set(['1']),
    });

    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        classification: 'DATA_MISMATCH',
        scopedEligibility: 'DATA_MISMATCH',
        action: 'reject',
      }),
    );
    expect(plan.counts.rejected).toBe(1);
    expect(plan.counts.creates.placements).toBe(0);
  });

  it('allows claims, endorsements, suspicious expiry, and material share delta only when financially resolved', () => {
    const source = offer({
      payment_status: 'PAID',
      facultative_offer: 20,
      placed_share: 15,
      offer_claims: [{ offer_claim_id: 'claim-1' }],
      offer_endorsements: [{ offer_endorsement_id: 'endorsement-1' }],
      offer_detail: {
        policy_number: 'POL-1',
        insured_by: 'Insured',
        currency: 'GHS',
        period_of_insurance_to: '2034-02-07',
        offer_details: '[]',
      },
    });
    source.offer_participant![0].offer_participant_percentage = 15;
    source.offer_participant![0].participant_fac_premium = 150;
    source.offer_participant![0].participant_fac_sum_insured = 150;
    source.fac_premium = 150;
    source.fac_sum_insured = 150;
    const plan = generator.build({
      tenantSlug: 'acme-ghana',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      mode: 'dry-run',
      offers: [source],
      scopedFinancialResolvedOfferIds: new Set(['1']),
    });

    expect(plan.records[0]).toEqual(
      expect.objectContaining({
        classification: 'NEEDS_FINANCIAL_REVIEW',
        scopedEligibility: 'SCOPED_FINANCIAL_RESOLVED',
        action: 'create',
      }),
    );
    expect(plan.records[0]?.reasons).toEqual(
      expect.arrayContaining([
        'claims-present',
        'endorsements-present',
        'suspicious-expiry-date',
        'material-facultative-offer-vs-placed-share-delta',
      ]),
    );
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
    created_at: '2026-09-08 08:50:34',
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
