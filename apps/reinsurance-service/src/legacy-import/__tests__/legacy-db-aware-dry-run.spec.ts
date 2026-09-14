import { PrismaClient } from '../../../prisma/generated/client';
import { LegacyDbAwareDryRun } from '../legacy-db-aware-dry-run';
import { riskFieldDefinitionHash, sha256 } from '../legacy-hash';
import {
  counterpartyAddressLegacyId,
  historicalPlacementClosingHash,
  historicalPlacementClosingNumber,
} from '../legacy-offers.importer';
import { LegacyOffersNormalizer } from '../legacy-offers.normalizer';
import { LegacyOffersPlanGenerator } from '../legacy-offers.plan';
import { LegacyOffer } from '../legacy-import.types';
import {
  resolveLegacyRiskClass,
  riskClassDefinitionHash,
  riskTypeDefinitionHash,
} from '../legacy-risk-taxonomy';

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
          riskTypeLegacyId: '1',
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

  it('plans Motor Comprehensive as RiskClass Motor and a legacy-id RiskType', async () => {
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
        classofbusiness: {
          class_of_business_id: '1',
          business_name: 'Motor Comprehensive',
          business_details: '[{"keydetail":"Vehicle Make"}]',
        },
      }),
    ]);

    expect(result.resolution.plannedEntities.riskClasses).toEqual([
      expect.objectContaining({
        entityType: 'risk_class',
        legacyId: 'motor',
        action: 'create',
      }),
    ]);
    expect(result.resolution.plannedEntities.riskTypes).toEqual([
      expect.objectContaining({
        entityType: 'risk_type',
        legacyId: '1',
        action: 'create',
      }),
    ]);
    expectNoWrites(writeFns);
  });

  it('plans multiple RiskTypes under one shared mapped RiskClass', async () => {
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
        offer_id: '6',
        classofbusiness: {
          class_of_business_id: '40',
          business_name: 'Performance Bond',
          business_details: '[{"keydetail":"Bond Description"}]',
        },
      }),
      offer({
        offer_id: '7',
        classofbusiness: {
          class_of_business_id: '41',
          business_name: 'Advance Payment Bond',
          business_details: '[{"keydetail":"Bond Description"}]',
        },
      }),
    ]);

    expect(result.resolution.plannedEntities.riskClasses).toEqual([
      expect.objectContaining({
        entityType: 'risk_class',
        legacyId: 'bond',
        action: 'create',
      }),
    ]);
    expect(result.resolution.plannedEntities.riskTypes).toEqual([
      expect.objectContaining({ legacyId: '40', action: 'create' }),
      expect.objectContaining({ legacyId: '41', action: 'create' }),
    ]);
    expectNoWrites(writeFns);
  });

  it('plans one current RiskType create for same-run aliases', async () => {
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
      retentionBondOffer('5', '8'),
      retentionBondOffer('30', '9'),
    ]);

    expect(result.resolution.plannedEntities.riskTypes).toEqual([
      expect.objectContaining({ legacyId: '5', action: 'create' }),
      expect.objectContaining({
        legacyId: '30',
        action: 'reuse',
        reason: 'same-run-risk-type-alias-would-reuse-current-risk-type',
      }),
    ]);
    expectNoWrites(writeFns);
  });

  it('plans unioned fields and shared field alias maps for duplicate RiskTypes', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma: retentionPrisma } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 0 }],
      ],
      writeFns,
    );

    const retention = await resolveOffers(retentionPrisma, [
      retentionBondOffer('5', '10'),
      retentionBondOffer('30', '11'),
    ]);
    const { prisma: customsPrisma } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 0 }],
      ],
      writeFns,
    );
    const customs = await resolveOffers(customsPrisma, [
      customsTransitBondOffer('44', '12'),
      customsTransitBondOffer('65', '13'),
    ]);

    expect(retention.resolution.plannedEntities.riskTypeFields).toEqual([
      expect.objectContaining({
        legacyId: '5:project_description',
        action: 'create',
      }),
      expect.objectContaining({
        legacyId: '5:obligee_interest',
        action: 'create',
      }),
      expect.objectContaining({
        legacyId: '30:project_description',
        action: 'reuse',
        reason:
          'same-run-risk-type-field-alias-would-reuse-current-risk-type-field',
      }),
      expect.objectContaining({
        legacyId: '30:obligee_interest',
        action: 'reuse',
      }),
    ]);
    expect(
      customs.resolution.plannedEntities.riskTypeFields.map(
        (field) => field.legacyId,
      ),
    ).toEqual([
      '44:transit',
      '44:obligee_authority',
      '44:nature_of_goods',
      '65:description_of_bond',
      '65:obligee_employer',
    ]);
    expectNoWrites(writeFns);
  });

  it('plans alias maps as idempotent skips on rerun', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 2 }],
      ],
      writeFns,
    );
    const riskClass = resolveLegacyRiskClass('Retention Bond')!;
    legacyImportMapFindMany.mockResolvedValue([
      {
        entityType: 'risk_type',
        legacyId: '5',
        currentModel: 'RiskType',
        currentId: 'risk-type-retention',
        rawHash: riskTypeDefinitionHash({
          legacyClassId: '5',
          riskTypeName: 'Retention Bond',
          riskClass,
        }),
      },
      {
        entityType: 'risk_type',
        legacyId: '30',
        currentModel: 'RiskType',
        currentId: 'risk-type-retention',
        rawHash: riskTypeDefinitionHash({
          legacyClassId: '30',
          riskTypeName: 'Retention Bond',
          riskClass,
        }),
      },
    ]);

    const result = await resolveOffers(prisma, [
      retentionBondOffer('5', '14'),
      retentionBondOffer('30', '15'),
    ]);

    expect(result.resolution.plannedEntities.riskTypes).toEqual([
      expect.objectContaining({ legacyId: '5', action: 'skip' }),
      expect.objectContaining({ legacyId: '30', action: 'skip' }),
    ]);
    expectNoWrites(writeFns);
  });

  it('plans mapped risk taxonomy maps as idempotent skips', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 2 }],
      ],
      writeFns,
    );
    const riskClass = resolveLegacyRiskClass('Motor Comprehensive')!;
    legacyImportMapFindMany.mockResolvedValue([
      {
        entityType: 'risk_class',
        legacyId: 'motor',
        currentModel: 'RiskClass',
        currentId: 'risk-class-motor',
        rawHash: riskClassDefinitionHash(riskClass),
      },
      {
        entityType: 'risk_type',
        legacyId: '1',
        currentModel: 'RiskType',
        currentId: 'risk-type-motor-comprehensive',
        rawHash: riskTypeDefinitionHash({
          legacyClassId: '1',
          riskTypeName: 'Motor Comprehensive',
          riskClass,
        }),
      },
    ]);

    const result = await resolveOffers(prisma, [
      offer({
        classofbusiness: {
          class_of_business_id: '1',
          business_name: 'Motor Comprehensive',
          business_details: '[{"keydetail":"Vehicle Make"}]',
        },
      }),
    ]);

    expect(result.resolution.plannedEntities.riskClasses[0]).toEqual(
      expect.objectContaining({
        legacyId: 'motor',
        action: 'skip',
        reason: 'legacy-import-map-match',
      }),
    );
    expect(result.resolution.plannedEntities.riskTypes[0]).toEqual(
      expect.objectContaining({
        legacyId: '1',
        action: 'skip',
        reason: 'legacy-import-map-match',
      }),
    );
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

  it('projects DB-aware participant, closing, reference, and map counts', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 0 }],
      ],
      writeFns,
    );

    const result = await resolveOffers(prisma, [offer()]);

    expect(result.plan.counts.creates.participants).toBe(0);
    expect(result.resolution.projectedCounts.currencies.create).toBe(1);
    expect(result.resolution.projectedCounts.counterparties.create).toBe(2);
    expect(result.resolution.projectedCounts.riskClasses.create).toBe(1);
    expect(result.resolution.projectedCounts.riskTypes.create).toBe(1);
    expect(result.resolution.projectedCounts.riskTypeFields.create).toBe(1);
    expect(result.resolution.projectedCounts.placements.create).toBe(1);
    expect(result.resolution.projectedCounts.participants.create).toBe(1);
    expect(result.resolution.projectedCounts.placementClosings.create).toBe(1);
    expect(result.resolution.projectedCounts.legacyImportMaps.create).toBe(9);
    expect(
      result.resolution.projectedCounts.legacyImportMaps.byEntityType
        .offer_participant.create,
    ).toBe(1);
    expectNoWrites(writeFns);
  });

  it('treats reference-only preload as complete when only offer-only RiskTypeFields are absent', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 2 }],
      ],
      writeFns,
    );
    const source = offerWithOfferOnlyField();
    const normalized = new LegacyOffersNormalizer().normalize(source);
    const riskClass = resolveLegacyRiskClass(normalized.className)!;
    legacyImportMapFindMany.mockResolvedValue([
      {
        entityType: 'currency',
        legacyId: 'GHS',
        currentModel: 'Currency',
        currentId: 'currency-1',
        rawHash: sha256({ currency: 'GHS' }),
      },
      {
        entityType: 'insurer',
        legacyId: '15',
        currentModel: 'Counterparty',
        currentId: 'cedant-1',
        rawHash: sha256(source.insurer),
      },
      {
        entityType: 'reinsurer',
        legacyId: 'r1',
        currentModel: 'Counterparty',
        currentId: 'reinsurer-1',
        rawHash: sha256(source.offer_participant?.[0].reinsurer),
      },
      {
        entityType: 'risk_class',
        legacyId: 'motor',
        currentModel: 'RiskClass',
        currentId: 'risk-class-1',
        rawHash: riskClassDefinitionHash(riskClass),
      },
      {
        entityType: 'risk_type',
        legacyId: '25',
        currentModel: 'RiskType',
        currentId: 'risk-type-25',
        rawHash: riskTypeDefinitionHash({
          legacyClassId: '25',
          riskTypeName: normalized.className,
          riskClass,
        }),
      },
      {
        entityType: 'risk_type_field',
        legacyId: '25:vehicle_make',
        currentModel: 'RiskTypeField',
        currentId: 'risk-field-vehicle-make',
        rawHash: riskFieldDefinitionHash({
          riskTypeLegacyId: '25',
          key: 'Vehicle Make',
          normalizedKey: 'vehicle_make',
        }),
      },
    ]);
    const plan = new LegacyOffersPlanGenerator().build({
      tenantSlug: 'acme-ghana',
      sourceFilePath: 'legacy-offers.json',
      sourceFileHash: 'file-hash',
      offers: [source],
      mode: 'dry-run',
      fixtureOfferIds: [],
      batchSelection: {
        mode: 'reference-only',
        selectedOfferIds: [String(source.offer_id)],
        classification: 'AUTO_SAFE',
      },
    });

    const result = await new LegacyDbAwareDryRun(prisma).resolve({
      tenantSlug: 'acme-ghana',
      plan,
      normalizedOffers: [normalized],
    });

    const fieldIds = result.resolution.plannedEntities.riskTypeFields.map(
      (field) => field.legacyId,
    );
    expect(fieldIds).toEqual(['25:vehicle_make']);
    expect(fieldIds).not.toContain('25:year_of_manufacture');
    expect(result.resolution.projectedCounts.riskTypeFields.create).toBe(0);
    expect(result.plan.counts.conflicts).toBe(0);
    expect(legacyImportMapFindMany).toHaveBeenCalledTimes(1);
    expectNoWrites(writeFns);
  });

  it('projects existing fixture maps as skips instead of creates', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 2 }],
      ],
      writeFns,
    );
    const source = offer();
    const normalized = new LegacyOffersNormalizer().normalize(source);
    legacyImportMapFindMany.mockResolvedValue([
      {
        entityType: 'offer',
        legacyId: '1',
        currentModel: 'Placement',
        currentId: 'placement-1',
        rawHash: normalized.rawHash,
      },
      {
        entityType: 'offer_participant',
        legacyId: 'p1',
        currentModel: 'PlacementParticipant',
        currentId: 'participant-1',
        rawHash: normalized.participants[0].rawHash,
      },
      {
        entityType: 'offer_participant_closing',
        legacyId: 'p1',
        currentModel: 'PlacementClosing',
        currentId: 'closing-1',
        rawHash: historicalPlacementClosingHash(
          normalized,
          normalized.participants[0],
        ),
      },
    ]);

    const result = await resolveOffers(prisma, [source]);

    expect(result.resolution.projectedCounts.placements.skip).toBe(1);
    expect(result.resolution.projectedCounts.participants.skip).toBe(1);
    expect(result.resolution.projectedCounts.placementClosings.skip).toBe(1);
    expect(result.resolution.projectedCounts.legacyImportMaps.skip).toBe(3);
    expect(result.resolution.projectedCounts.legacyImportMaps.create).toBe(6);
    expectNoWrites(writeFns);
  });

  it('plans historical placement closings for eligible participants', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 0 }],
      ],
      writeFns,
    );

    const result = await resolveOffers(prisma, [offer()]);

    expect(result.resolution.plannedEntities.placementClosings).toEqual([
      expect.objectContaining({
        entityType: 'offer_participant_closing',
        legacyId: 'p1',
        action: 'create',
        currentModel: 'PlacementClosing',
      }),
    ]);
    expectNoWrites(writeFns);
  });

  it('plans historical placement closings as idempotent skips on repeat dry-run', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany } = prismaMock(
      [
        [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
        [{ id: 'user-1', email: 'admin@acmeghana.com', role: 'TENANT_ADMIN' }],
        [{ count: 2 }],
      ],
      writeFns,
    );
    const source = offer();
    const normalized = new LegacyOffersNormalizer().normalize(source);
    legacyImportMapFindMany.mockResolvedValue([
      {
        entityType: 'offer_participant_closing',
        legacyId: 'p1',
        currentModel: 'PlacementClosing',
        currentId: 'closing-1',
        rawHash: historicalPlacementClosingHash(
          normalized,
          normalized.participants[0],
        ),
      },
    ]);

    const result = await resolveOffers(prisma, [source]);

    expect(result.resolution.plannedEntities.placementClosings).toEqual([
      expect.objectContaining({
        legacyId: 'p1',
        action: 'skip',
        currentId: 'closing-1',
        reason: 'legacy-import-map-match',
      }),
    ]);
    expectNoWrites(writeFns);
  });

  it('reports closing-number collisions as DB-aware conflicts', async () => {
    const writeFns = writeFunctionMocks();
    const { prisma, legacyImportMapFindMany, placementClosingFindMany } =
      prismaMock(
        [
          [{ id: 'tenant-1', slug: 'acme-ghana', name: 'Acme Ghana' }],
          [
            {
              id: 'user-1',
              email: 'admin@acmeghana.com',
              role: 'TENANT_ADMIN',
            },
          ],
          [{ count: 2 }],
        ],
        writeFns,
      );
    const source = offer();
    legacyImportMapFindMany.mockResolvedValue([
      {
        entityType: 'offer',
        legacyId: '1',
        currentModel: 'Placement',
        currentId: 'placement-existing',
        rawHash: new LegacyOffersNormalizer().normalize(source).rawHash,
      },
    ]);
    placementClosingFindMany.mockResolvedValue([
      {
        id: 'closing-unrelated',
        placementId: 'placement-existing',
        closingNumber: historicalPlacementClosingNumber('p1'),
      },
    ]);

    const result = await resolveOffers(prisma, [source]);

    expect(result.resolution.plannedEntities.placementClosings[0]).toEqual(
      expect.objectContaining({
        legacyId: 'p1',
        action: 'conflict',
        reason: 'matching-closing-number-found-without-import-map',
      }),
    );
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
  const placementClosingFindMany = jest.fn().mockResolvedValue([]);
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
    placementClosing: { findMany: placementClosingFindMany, ...writeFns },
    legacyImportMap: { findMany: legacyImportMapFindMany, ...writeFns },
    legacyImportRun: writeFns,
    $executeRaw: writeFns.$executeRaw,
    $transaction: writeFns.$transaction,
  } as unknown as PrismaClient;
  return { prisma, legacyImportMapFindMany, placementClosingFindMany };
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
        offer_amount: 180,
        participant_fac_premium: 200,
        participant_fac_sum_insured: 200,
        offer_extra_charges: {
          agreed_commission: 10,
          agreed_commission_amount: 20,
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

function offerWithOfferOnlyField(): LegacyOffer {
  return offer({
    offer_id: '25',
    classofbusiness: {
      class_of_business_id: '25',
      business_name: 'Motor',
      business_details: '[{"keydetail":"Vehicle Make"}]',
    },
    offer_detail: {
      policy_number: 'POL-25',
      insured_by: 'Insured',
      currency: 'GHS',
      offer_details: JSON.stringify([
        { keydetail: 'Vehicle Make', value: 'Truck' },
        { keydetail: 'Year of Manufacture', value: '2018' },
      ]),
    },
  });
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

function retentionBondOffer(classId: string, offerId: string): LegacyOffer {
  return offer({
    offer_id: offerId,
    classofbusiness: {
      class_of_business_id: classId,
      business_name: 'Retention Bond',
      business_details:
        '[{"keydetail":"Project Description"},{"keydetail":"Obligee/Interest"}]',
    },
    offer_detail: {
      policy_number: `POL-${offerId}`,
      insured_by: 'Insured',
      currency: 'GHS',
      offer_details:
        '[{"keydetail":"Project Description","value":"Project"},{"keydetail":"Obligee/Interest","value":"Authority"}]',
    },
  });
}

function customsTransitBondOffer(
  classId: '44' | '65',
  offerId: string,
): LegacyOffer {
  return offer({
    offer_id: offerId,
    classofbusiness:
      classId === '44'
        ? {
            class_of_business_id: classId,
            business_name: 'Customs Transit Bond',
            business_details:
              '[{"keydetail":"Transit "},{"keydetail":"Obligee/Authority "},{"keydetail":"Nature of Goods"}]',
          }
        : {
            class_of_business_id: classId,
            business_name: 'Customs Transit Bond',
            business_details:
              '[{"keydetail":"Description of Bond"},{"keydetail":"Obligee/Employer "}]',
          },
    offer_detail:
      classId === '44'
        ? {
            policy_number: `POL-${offerId}`,
            insured_by: 'Insured',
            currency: 'GHS',
            offer_details:
              '[{"keydetail":"Transit ","value":"Road"},{"keydetail":"Obligee/Authority ","value":"GRA"},{"keydetail":"Nature of Goods","value":"Cargo"}]',
          }
        : {
            policy_number: `POL-${offerId}`,
            insured_by: 'Insured',
            currency: 'GHS',
            offer_details:
              '[{"keydetail":"Description of Bond","value":"Bond"},{"keydetail":"Obligee/Employer ","value":"GRA"}]',
          },
  });
}
