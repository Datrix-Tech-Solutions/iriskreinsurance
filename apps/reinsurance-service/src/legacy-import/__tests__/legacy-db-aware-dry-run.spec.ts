import { PrismaClient } from '../../../prisma/generated/client';
import { LegacyDbAwareDryRun } from '../legacy-db-aware-dry-run';
import { riskFieldDefinitionHash, sha256 } from '../legacy-hash';
import { counterpartyAddressLegacyId } from '../legacy-offers.importer';
import { LegacyOffersNormalizer } from '../legacy-offers.normalizer';
import { LegacyOffersPlanGenerator } from '../legacy-offers.plan';
import { LegacyOffer } from '../legacy-import.types';

describe('LegacyDbAwareDryRun', () => {
  it('performs read-only planning and continues when tracking tables are absent', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 0 }],
      ],
      writeFns,
    );
    const offers = [offer()];
    const normalizedOffers = offers.map((source) =>
      new LegacyOffersNormalizer().normalize(source),
    );
    const plan = new LegacyOffersPlanGenerator().build({
      tenantSlug: 'acme-ghana',
      tenantId: undefined,
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      offers,
      mode: 'dry-run',
      fixtureOfferIds: ['1'],
    });

    const result = await new LegacyDbAwareDryRun(prisma).resolve({
      tenantSlug: 'acme-ghana',
      plan,
      normalizedOffers,
    });

    expect(result.resolution.tenant.id).toBe('tenant-1');
    expect(result.resolution.trackingTablesAvailable).toBe(false);
    expect(result.existingMaps).toEqual([]);
    expect(result.resolution.plannedEntities.currencies[0].action).toBe(
      'create',
    );
    expect(legacyImportMapFindMany).not.toHaveBeenCalled();
    expectNoWrites(writeFns);
  });

  it('reads LegacyImportMap when tracking tables are available and never writes', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 2 }],
      ],
      writeFns,
    );
    legacyImportMapFindMany.mockResolvedValue([
      {
        entityType: 'currency',
        legacyId: 'GHS',
        currentModel: 'Currency',
        currentId: 'currency-1',
        rawHash: sha256({ currency: 'GHS' }),
      },
    ]);
    const offers = [offer()];
    const normalizedOffers = offers.map((source) =>
      new LegacyOffersNormalizer().normalize(source),
    );
    const plan = new LegacyOffersPlanGenerator().build({
      tenantSlug: 'acme-ghana',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      offers,
      mode: 'dry-run',
      fixtureOfferIds: ['1'],
    });

    const result = await new LegacyDbAwareDryRun(prisma).resolve({
      tenantSlug: 'acme-ghana',
      plan,
      normalizedOffers,
    });

    expect(result.resolution.trackingTablesAvailable).toBe(true);
    expect(legacyImportMapFindMany).toHaveBeenCalledTimes(1);
    expect(result.resolution.plannedEntities.currencies[0].action).toBe('skip');
    expectNoWrites(writeFns);
  });

  it('skips NEEDS_FINANCIAL_REVIEW placements and participants', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 0 }],
      ],
      writeFns,
    );
    const result = await resolveOffers(prisma, [
      offer({ offer_id: '2', payment_status: 'PAID' }),
    ]);

    const placement = result.resolution.plannedEntities.placements[0];
    const participant = result.resolution.plannedEntities.participants[0];
    expect(placement).toMatchObject({ legacyId: '2', action: 'skip' });
    expect(placement.reason).toContain('phase-1-financial-review');
    expect(participant).toMatchObject({ legacyId: 'p1', action: 'skip' });
    expect(participant.reason).toContain('phase-1-financial-review');
    expectNoWrites(writeFns);
  });

  it('skips DATA_MISMATCH placements and participants', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 0 }],
      ],
      writeFns,
    );
    const source = offer({ offer_id: '3' });
    source.offer_participant![0].participant_fac_premium = 199.9;

    const result = await resolveOffers(prisma, [source]);

    const placement = result.resolution.plannedEntities.placements[0];
    const participant = result.resolution.plannedEntities.participants[0];
    expect(placement).toMatchObject({ legacyId: '3', action: 'skip' });
    expect(placement.reason).toContain('phase-1-rejected');
    expect(participant).toMatchObject({ legacyId: 'p1', action: 'skip' });
    expect(participant.reason).toContain('phase-1-rejected');
    expectNoWrites(writeFns);
  });

  it('does not plan dependencies that are exclusive to non-eligible offers', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 0 }],
      ],
      writeFns,
    );

    const result = await resolveOffers(prisma, [
      offer({
        offer_id: '4',
        payment_status: 'PARTPAYMENT',
        offer_detail: {
          policy_number: 'POL-4',
          insured_by: 'Insured',
          currency: 'USD',
          offer_details: '[{"keydetail":"Hull","value":"Vessel"}]',
        },
        insurer: {
          insurer_id: '3',
          insurer_company_name: 'Review Cedant',
          insurer_address: { country: 'Ghana' },
        },
        classofbusiness: {
          class_of_business_id: 'marine',
          business_name: 'Marine',
          business_details: '[{"keydetail":"Hull"}]',
        },
        offer_participant: [
          {
            offer_participant_id: 'p4',
            offer_participant_percentage: 20,
            participant_fac_premium: 200,
            participant_fac_sum_insured: 200,
            offer_extra_charges: { agreed_commission_amount: 20 },
            reinsurer: {
              reinsurer_id: '3',
              re_company_name: 'Review Reinsurer',
              reinsurer_address: { country: 'Ghana' },
            },
          },
        ],
      }),
    ]);

    expect(result.resolution.plannedEntities.currencies).toEqual([]);
    expect(result.resolution.plannedEntities.counterparties).toEqual([]);
    expect(result.resolution.plannedEntities.addresses).toEqual([]);
    expect(result.resolution.plannedEntities.riskClasses).toEqual([]);
    expect(result.resolution.plannedEntities.riskTypes).toEqual([]);
    expect(result.resolution.plannedEntities.riskTypeFields).toEqual([]);
    expectNoWrites(writeFns);
  });

  it('namespaces insurer and reinsurer address import identities', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 0 }],
      ],
      writeFns,
    );

    const result = await resolveOffers(prisma, [offerWithAddressIdCollision()]);
    const legacyIds = result.resolution.plannedEntities.addresses.map(
      (address) => address.legacyId,
    );

    expect(legacyIds).toEqual([
      counterpartyAddressLegacyId('insurer', '3'),
      counterpartyAddressLegacyId('reinsurer', '3'),
    ]);
    expect(new Set(legacyIds).size).toBe(2);
    expectNoWrites(writeFns);
  });

  it('plans matching address maps as idempotent skips', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 2 }],
      ],
      writeFns,
    );
    const source = offerWithAddressIdCollision();
    legacyImportMapFindMany.mockResolvedValue([
      {
        entityType: 'counterparty_address',
        legacyId: counterpartyAddressLegacyId('insurer', '3'),
        currentModel: 'CounterpartyAddress',
        currentId: 'address-insurer-3',
        rawHash: sha256(source.insurer?.insurer_address),
      },
      {
        entityType: 'counterparty_address',
        legacyId: counterpartyAddressLegacyId('reinsurer', '3'),
        currentModel: 'CounterpartyAddress',
        currentId: 'address-reinsurer-3',
        rawHash: sha256(
          source.offer_participant?.[0].reinsurer?.reinsurer_address,
        ),
      },
    ]);

    const result = await resolveOffers(prisma, [source]);

    expect(result.resolution.plannedEntities.addresses).toEqual([
      expect.objectContaining({
        legacyId: counterpartyAddressLegacyId('insurer', '3'),
        action: 'skip',
        currentId: 'address-insurer-3',
        reason: 'legacy-import-map-match',
      }),
      expect.objectContaining({
        legacyId: counterpartyAddressLegacyId('reinsurer', '3'),
        action: 'skip',
        currentId: 'address-reinsurer-3',
        reason: 'legacy-import-map-match',
      }),
    ]);
    expectNoWrites(writeFns);
  });

  it('uses stable risk-field definition hashes independent of offer values', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 2 }],
      ],
      writeFns,
    );
    legacyImportMapFindMany.mockResolvedValue([
      {
        entityType: 'risk_type_field',
        legacyId: '1:vehicle_make',
        currentModel: 'RiskTypeField',
        currentId: 'risk-field-vehicle-make',
        rawHash: riskFieldDefinitionHash({
          classId: '1',
          key: 'Vehicle Make',
          normalizedKey: 'vehicle_make',
        }),
      },
    ]);

    const result = await resolveOffers(prisma, [
      offer({
        offer_id: '6',
        offer_detail: {
          policy_number: 'POL-6',
          insured_by: 'Insured',
          currency: 'GHS',
          offer_details: '[{"keydetail":"Vehicle Make","value":"Truck"}]',
        },
      }),
      offer({
        offer_id: '7',
        offer_detail: {
          policy_number: 'POL-7',
          insured_by: 'Insured',
          currency: 'GHS',
          offer_details: '[{"keydetail":"Vehicle Make","value":"Bus"}]',
        },
      }),
    ]);

    expect(result.resolution.plannedEntities.riskTypeFields).toEqual([
      expect.objectContaining({
        legacyId: '1:vehicle_make',
        action: 'skip',
        reason: 'legacy-import-map-match',
      }),
    ]);
    expect(result.plan.counts.conflicts).toBe(0);
    expectNoWrites(writeFns);
  });

  it('rolls DB-aware conflicts into top-level plan counts', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 2 }],
      ],
      writeFns,
    );
    legacyImportMapFindMany.mockResolvedValue([
      {
        entityType: 'risk_type_field',
        legacyId: '1:vehicle_make',
        currentModel: 'RiskTypeField',
        currentId: 'risk-field-vehicle-make',
        rawHash: 'old-definition-hash',
      },
    ]);

    const result = await resolveOffers(prisma, [offer()]);

    expect(result.resolution.plannedEntities.riskTypeFields).toEqual([
      expect.objectContaining({
        legacyId: '1:vehicle_make',
        action: 'conflict',
        reason: 'legacy-import-map-raw-hash-mismatch',
      }),
    ]);
    expect(result.plan.counts.conflicts).toBe(1);
    expectNoWrites(writeFns);
  });
});

async function resolveOffers(prisma: PrismaClient, offers: LegacyOffer[]) {
  const normalizedOffers = offers.map((source) =>
    new LegacyOffersNormalizer().normalize(source),
  );
  const plan = new LegacyOffersPlanGenerator().build({
    tenantSlug: 'acme-ghana',
    sourceFilePath: 'legacy-offers.json',
    sourceFileHash: 'file-hash',
    offers,
    mode: 'dry-run',
    fixtureOfferIds: offers.map((item) => String(item.offer_id)),
  });

  return new LegacyDbAwareDryRun(prisma).resolve({
    tenantSlug: 'acme-ghana',
    plan,
    normalizedOffers,
  });
}

function prismaMock(
  queryRawResults: unknown[][],
  writeFns: ReturnType<typeof writeFunctionMocks>,
) {
  const queryRaw = jest.fn();
  for (const result of queryRawResults) {
    queryRaw.mockResolvedValueOnce(result);
  }
  const findMany = jest.fn().mockResolvedValue([]);
  const legacyImportMapFindMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    $queryRaw: queryRaw,
    currency: { findMany, ...writeFns },
    counterparty: { findMany, ...writeFns },
    counterpartyAddress: { findMany, ...writeFns },
    riskClass: { findMany, ...writeFns },
    riskType: { findMany, ...writeFns },
    riskTypeField: { findMany, ...writeFns },
    placement: { findMany, ...writeFns },
    placementParticipant: { findMany, ...writeFns },
    legacyImportMap: { findMany: legacyImportMapFindMany, ...writeFns },
    legacyImportRun: writeFns,
    $executeRaw: writeFns.$executeRaw,
    $transaction: writeFns.$transaction,
  } as unknown as PrismaClient;
  return { prisma, legacyImportMapFindMany };
}

function writeFunctionMocks() {
  return {
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    updateMany: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };
}

function expectNoWrites(writeFns: ReturnType<typeof writeFunctionMocks>) {
  expect(writeFns.create).not.toHaveBeenCalled();
  expect(writeFns.update).not.toHaveBeenCalled();
  expect(writeFns.upsert).not.toHaveBeenCalled();
  expect(writeFns.delete).not.toHaveBeenCalled();
  expect(writeFns.deleteMany).not.toHaveBeenCalled();
  expect(writeFns.createMany).not.toHaveBeenCalled();
  expect(writeFns.updateMany).not.toHaveBeenCalled();
  expect(writeFns.$executeRaw).not.toHaveBeenCalled();
  expect(writeFns.$transaction).not.toHaveBeenCalled();
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
    ...overrides,
  };
}

function offerWithAddressIdCollision(): LegacyOffer {
  return offer({
    offer_id: '5',
    insurer: {
      insurer_id: '3',
      insurer_company_name: 'Collision Cedant',
      insurer_address: {
        street: '1 Cedant Road',
        suburb: 'Accra',
        region: 'Greater Accra',
        country: 'Ghana',
      },
    },
    offer_participant: [
      {
        offer_participant_id: 'p5',
        offer_participant_percentage: 20,
        participant_fac_premium: 200,
        participant_fac_sum_insured: 200,
        offer_extra_charges: { agreed_commission_amount: 20 },
        reinsurer: {
          reinsurer_id: '3',
          re_company_name: 'Collision Reinsurer',
          reinsurer_address: {
            street: '1 Re Road',
            suburb: 'Accra',
            region: 'Greater Accra',
            country: 'Ghana',
          },
        },
      },
    ],
  });
}
