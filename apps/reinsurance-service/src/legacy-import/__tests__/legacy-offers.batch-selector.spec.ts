import {
  selectLegacyOffersForImport,
  validateApplySelection,
} from '../legacy-offers.batch-selector';
import { sha256 } from '../legacy-hash';
import { LegacyOffer } from '../legacy-import.types';
import { LegacyOffersPlanGenerator } from '../legacy-offers.plan';

describe('legacy offer batch selection', () => {
  it('selects the deterministic first 50 AUTO_SAFE offer IDs', () => {
    const offers = Array.from({ length: 60 }, (_, index) =>
      offer({ offer_id: String(1000 - index) }),
    );

    const selection = selectLegacyOffersForImport({
      offers,
      classification: 'AUTO_SAFE',
      batchSize: 50,
    });

    expect(selection.mode).toBe('classification-batch');
    expect(selection.selectedOfferIds).toHaveLength(50);
    expect(selection.selectedOfferIds[0]).toBe('1000');
    expect(selection.selectedOfferIds[49]).toBe('951');
  });

  it('selects the same membership for repeated dry-runs', () => {
    const offers = [offer({ offer_id: '10' }), offer({ offer_id: '12' })];

    const first = selectLegacyOffersForImport({
      offers,
      classification: 'AUTO_SAFE',
      batchSize: 2,
    });
    const second = selectLegacyOffersForImport({
      offers,
      classification: 'AUTO_SAFE',
      batchSize: 2,
    });

    expect(second.selectedOfferIds).toEqual(first.selectedOfferIds);
  });

  it('does not overlap batch 2 with batch 1 when using after-offer-id', () => {
    const offers = Array.from({ length: 60 }, (_, index) =>
      offer({ offer_id: String(1000 - index) }),
    );

    const first = selectLegacyOffersForImport({
      offers,
      classification: 'AUTO_SAFE',
      batchSize: 50,
    });
    const second = selectLegacyOffersForImport({
      offers,
      classification: 'AUTO_SAFE',
      batchSize: 50,
      afterOfferId: first.selectedOfferIds.at(-1),
    });

    expect(second.selectedOfferIds[0]).toBe('950');
    expect(
      first.selectedOfferIds.some((offerId) =>
        second.selectedOfferIds.includes(offerId),
      ),
    ).toBe(false);
  });

  it('selects the deterministic first AUTO_SAFE batch after fixture offer 6739', () => {
    const selection = selectLegacyOffersForImport({
      offers: [
        offer({ offer_id: '6740' }),
        offer({ offer_id: '6739' }),
        offer({ offer_id: '6738', payment_status: 'PAID' }),
        financialMismatchOffer('6737'),
        offer({ offer_id: '6736' }),
        offer({ offer_id: '6735' }),
        offer({ offer_id: '6734' }),
      ],
      classification: 'AUTO_SAFE',
      batchSize: 3,
      afterOfferId: '6739',
    });

    expect(selection.selectedOfferIds).toEqual(['6736', '6735', '6734']);
  });

  it('rejects classification filters that are not AUTO_SAFE', () => {
    expect(() =>
      selectLegacyOffersForImport({
        offers: [offer()],
        classification: 'NEEDS_FINANCIAL_REVIEW',
        batchSize: 1,
      }),
    ).toThrow('Batch selection supports only --classification AUTO_SAFE.');
  });

  it('enforces an explicit batch size limit', () => {
    expect(() =>
      selectLegacyOffersForImport({
        offers: [offer()],
        classification: 'AUTO_SAFE',
        batchSize: 251,
      }),
    ).toThrow('--batch-size must be <= 250.');
  });

  it('refuses accidental unrestricted apply selections', () => {
    const selection = selectLegacyOffersForImport({ offers: [offer()] });

    expect(() => validateApplySelection(selection)).toThrow(
      'Apply requires --fixture or --classification AUTO_SAFE with --batch-size.',
    );
  });

  it('requires explicit AUTO_SAFE reference-only mode for unrestricted reference apply', () => {
    const selection = selectLegacyOffersForImport({
      offers: [
        offer({ offer_id: '3' }),
        offer({ offer_id: '2', payment_status: 'PAID' }),
        financialMismatchOffer('1'),
      ],
      referenceOnly: true,
      classification: 'AUTO_SAFE',
    });

    expect(selection.mode).toBe('reference-only');
    expect(selection.classification).toBe('AUTO_SAFE');
    expect(selection.selectedOfferIds).toEqual(['3']);
    expect(() => validateApplySelection(selection)).not.toThrow();
  });

  it('rejects reference-only without AUTO_SAFE classification', () => {
    expect(() =>
      selectLegacyOffersForImport({
        offers: [offer()],
        referenceOnly: true,
      }),
    ).toThrow('--reference-only requires --classification AUTO_SAFE');
  });

  it('rejects reference-only combined with placement selectors', () => {
    expect(() =>
      selectLegacyOffersForImport({
        offers: [offer()],
        referenceOnly: true,
        classification: 'AUTO_SAFE',
        batchSize: 1,
      }),
    ).toThrow(
      '--reference-only cannot be combined with --fixture, --batch-size, or --after-offer-id.',
    );
  });

  it('excludes suspicious-date records from deterministic AUTO_SAFE batches', () => {
    const selection = selectLegacyOffersForImport({
      offers: [
        offer({
          offer_id: '100',
          offer_detail: {
            policy_number: 'POL-100',
            insured_by: 'Insured',
            currency: 'GHS',
            period_of_insurance_from: '2026-01-01',
            period_of_insurance_to: '2034-02-07',
            offer_details: '[]',
          },
        }),
        offer({ offer_id: '99' }),
      ],
      classification: 'AUTO_SAFE',
      batchSize: 2,
    });

    expect(selection.selectedOfferIds).toEqual(['99']);
  });

  it('keeps fixture mode available and allows mapped fixture records to skip', () => {
    const selected = selectLegacyOffersForImport({
      offers: [offer({ offer_id: '6740' }), offer({ offer_id: '6739' })],
      fixtureOfferIds: ['6740', '6739'],
    });
    const plan = new LegacyOffersPlanGenerator().build({
      tenantSlug: 'stellar-tech',
      tenantId: 'tenant-1',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      offers: selected.selectedOffers,
      mode: 'dry-run',
      fixtureOfferIds: ['6740', '6739'],
      batchSelection: {
        mode: selected.mode,
        selectedOfferIds: selected.selectedOfferIds,
      },
      existingMaps: selected.selectedOffers.map((source) => ({
        entityType: 'offer',
        legacyId: String(source.offer_id),
        currentModel: 'Placement',
        currentId: `placement-${source.offer_id}`,
        rawHash: sha256(source),
      })),
    });

    expect(plan.records.map((record) => record.action)).toEqual([
      'skip',
      'skip',
    ]);
    expect(plan.batchSelection).toEqual({
      mode: 'fixture',
      selectedOfferIds: ['6740', '6739'],
    });
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
    commission_amount: 2,
    facultative_offer: 20,
    placed_share: 20,
    fac_premium: 20,
    fac_sum_insured: 200,
    insurer: { insurer_id: '15', insurer_company_name: 'Cedant' },
    classofbusiness: {
      class_of_business_id: '1',
      business_name: 'Motor Comprehensive',
      business_details: '[]',
    },
    offer_detail: {
      policy_number: `POL-${overrides.offer_id ?? '1'}`,
      insured_by: 'Insured',
      currency: 'GHS',
      offer_details: '[]',
    },
    offer_participant: [
      {
        offer_participant_id: `p-${overrides.offer_id ?? '1'}`,
        offer_participant_percentage: 20,
        offer_amount: 18,
        participant_fac_premium: 20,
        participant_fac_sum_insured: 200,
        offer_extra_charges: {
          agreed_commission: 10,
          agreed_commission_amount: 2,
          agreed_brokerage_percentage: 0,
          brokerage_amount: 0,
          nic_levy_amount: 0,
          withholding_tax_amount: 0,
        },
        reinsurer: { reinsurer_id: 'r1', re_company_name: 'Reinsurer' },
      },
    ],
    ...overrides,
  };
}

function financialMismatchOffer(offerId: string): LegacyOffer {
  const source = offer({ offer_id: offerId });
  source.offer_participant![0].participant_fac_premium = 19.9;
  return source;
}
