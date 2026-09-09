import { PrismaClient } from '../../../prisma/generated/client';
import { LegacyOffersImporter } from '../legacy-offers.importer';
import { LegacyOffersNormalizer } from '../legacy-offers.normalizer';
import { LegacyOffersPlanGenerator } from '../legacy-offers.plan';
import { LegacyOffer } from '../legacy-import.types';

describe('LegacyOffersImporter', () => {
  it('does not apply NEEDS_FINANCIAL_REVIEW or DATA_MISMATCH offers even if plan actions are malformed', async () => {
    const sources = [
      offer({ offer_id: 'review-1', payment_status: 'PAID' }),
      financialMismatchOffer(),
    ];
    const normalizedOffers = sources.map((source) =>
      new LegacyOffersNormalizer().normalize(source),
    );
    const generatedPlan = new LegacyOffersPlanGenerator().build({
      tenantSlug: 'acme-ghana',
      tenantId: 'tenant-1',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      offers: sources,
      mode: 'apply',
      fixtureOfferIds: ['review-1', 'mismatch-1'],
    });
    const malformedPlan = {
      ...generatedPlan,
      records: generatedPlan.records.map((record) => ({
        ...record,
        action: 'create' as const,
      })),
    };
    const tx = transactionMock();
    const transaction = jest.fn(
      (
        callback: (tx: ReturnType<typeof transactionMock>) => Promise<unknown>,
      ) => callback(tx),
    );
    const prisma = {
      $transaction: transaction,
    } as unknown as PrismaClient;

    const result = await new LegacyOffersImporter(prisma).apply({
      tenantId: 'tenant-1',
      tenantSlug: 'acme-ghana',
      importUserId: 'user-1',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      plan: malformedPlan,
      normalizedOffers,
    });

    expect(result.created.placements).toBe(0);
    expect(result.created.participants).toBe(0);
    expect(tx.currency.create).not.toHaveBeenCalled();
    expect(tx.counterparty.create).not.toHaveBeenCalled();
    expect(tx.counterpartyAddress.create).not.toHaveBeenCalled();
    expect(tx.riskClass.create).not.toHaveBeenCalled();
    expect(tx.riskType.create).not.toHaveBeenCalled();
    expect(tx.riskTypeField.create).not.toHaveBeenCalled();
    expect(tx.placement.create).not.toHaveBeenCalled();
    expect(tx.placementParticipant.create).not.toHaveBeenCalled();
  });
});

function transactionMock() {
  const delegate = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  return {
    legacyImportRun: {
      create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      update: jest.fn().mockResolvedValue({ id: 'run-1' }),
    },
    legacyImportMap: delegate,
    currency: delegate,
    counterparty: delegate,
    counterpartyAddress: delegate,
    riskClass: delegate,
    riskType: delegate,
    riskTypeField: delegate,
    placement: delegate,
    placementParticipant: delegate,
  };
}

function financialMismatchOffer(): LegacyOffer {
  const source = offer({ offer_id: 'mismatch-1' });
  source.offer_participant![0].participant_fac_premium = 199.9;
  return source;
}

function offer(overrides: Partial<LegacyOffer> = {}): LegacyOffer {
  return {
    offer_id: '1',
    offer_status: 'CLOSED',
    payment_status: 'UNPAID',
    claim_status: 'UNCLAIMED',
    sum_insured: 1000,
    premium: 100,
    rate: 10,
    commission: 20,
    commission_amount: 20,
    facultative_offer: 20,
    placed_share: 20,
    fac_premium: 200,
    fac_sum_insured: 200,
    insurer: { insurer_id: '15', insurer_company_name: 'Cedant' },
    classofbusiness: {
      class_of_business_id: '1',
      business_name: 'Motor',
      business_details: '[{"keydetail":"Vehicle Make"}]',
    },
    offer_detail: {
      policy_number: 'POL-1',
      insured_by: 'Insured',
      currency: 'GHS',
      offer_details: '[{"keydetail":"Vehicle Make","value":"Truck"}]',
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
    offer_claims: [],
    offer_endorsements: [],
    ...overrides,
  };
}
