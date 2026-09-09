import { PrismaClient } from '../../../prisma/generated/client';
import {
  LEGACY_IMPORT_TRANSACTION_OPTIONS,
  LegacyOffersImporter,
} from '../legacy-offers.importer';
import { LegacyOffersNormalizer } from '../legacy-offers.normalizer';
import { LegacyOffersPlanGenerator } from '../legacy-offers.plan';
import { LegacyOffer } from '../legacy-import.types';

describe('LegacyOffersImporter', () => {
  it('passes explicit interactive transaction options', async () => {
    const { prisma, transaction } = prismaMock();

    await new LegacyOffersImporter(prisma).apply(applyInput([offer()]));

    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      LEGACY_IMPORT_TRANSACTION_OPTIONS,
    );
  });

  it('does not apply NEEDS_FINANCIAL_REVIEW or DATA_MISMATCH offers even if plan actions are malformed', async () => {
    const sources = [
      offer({ offer_id: 'review-1', payment_status: 'PAID' }),
      financialMismatchOffer(),
    ];
    const input = applyInput(sources);
    input.plan = {
      ...input.plan,
      records: input.plan.records.map((record) => ({
        ...record,
        action: 'create' as const,
      })),
    };
    const { prisma, tx } = prismaMock();

    const result = await new LegacyOffersImporter(prisma).apply(input);

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

  it('uses only the transaction client for business writes', async () => {
    const { prisma, rootDelegates, tx } = prismaMock();

    await new LegacyOffersImporter(prisma).apply(applyInput([offer()]));

    for (const delegate of rootDelegates) {
      expect(delegate.create).not.toHaveBeenCalled();
      expect(delegate.findFirst).not.toHaveBeenCalled();
      expect(delegate.findUnique).not.toHaveBeenCalled();
    }
    expect(tx.placement.create).toHaveBeenCalledTimes(1);
    expect(tx.placementParticipant.create).toHaveBeenCalledTimes(1);
  });

  it('does not use the transaction client after the callback closes', async () => {
    const { prisma, txState } = prismaMock();

    await new LegacyOffersImporter(prisma).apply(applyInput([offer()]));

    expect(txState.usedAfterClose).toBe(false);
  });

  it('propagates transaction failure so a failed apply remains atomic', async () => {
    const { prisma, transactionState, tx } = prismaMock({
      failModel: 'placement',
    });

    await expect(
      new LegacyOffersImporter(prisma).apply(applyInput([offer()])),
    ).rejects.toThrow('placement create failed');

    expect(transactionState.rolledBack).toBe(true);
    expect(tx.legacyImportRun.update).not.toHaveBeenCalled();
  });

  it('preserves idempotency when exact import maps already exist', async () => {
    const source = offer();
    const input = applyInput([source]);
    const normalized = input.normalizedOffers[0];
    const { prisma, tx } = prismaMock({
      existingMaps: {
        currency: { GHS: 'currency-existing' },
        classofbusiness: { '1': 'risk-class-existing' },
        insurer: { '15': 'cedant-existing' },
        reinsurer: { r1: 'reinsurer-existing' },
        offer: { [normalized.offerId]: 'placement-existing' },
        offer_participant: {
          [normalized.participants[0].participantId]: 'participant-existing',
        },
      },
      existingRiskTypeId: 'risk-type-existing',
    });

    const result = await new LegacyOffersImporter(prisma).apply(input);

    expect(result.created.placements).toBe(0);
    expect(result.created.participants).toBe(0);
    expect(tx.currency.create).not.toHaveBeenCalled();
    expect(tx.counterparty.create).not.toHaveBeenCalled();
    expect(tx.riskClass.create).not.toHaveBeenCalled();
    expect(tx.riskType.create).not.toHaveBeenCalled();
    expect(tx.placement.create).not.toHaveBeenCalled();
    expect(tx.placementParticipant.create).not.toHaveBeenCalled();
  });

  it('caches import maps created earlier in the same transaction', async () => {
    const sources = [offer({ offer_id: '1' }), offer({ offer_id: '2' })];
    const { prisma, tx } = prismaMock();

    await new LegacyOffersImporter(prisma).apply(applyInput(sources));

    const currencyLookups = findUniqueLookups(tx, 'currency', 'GHS');
    const cedantLookups = findUniqueLookups(tx, 'insurer', '15');
    expect(currencyLookups).toBe(1);
    expect(cedantLookups).toBe(1);
  });
});

type ExistingMaps = Record<string, Record<string, string>>;
type PrismaDelegate = {
  findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  create: jest.Mock<Promise<{ id: string }>, [unknown]>;
  update: jest.Mock<Promise<{ id: string }>, [unknown]>;
};

function prismaMock(
  options: {
    existingMaps?: ExistingMaps;
    existingRiskTypeId?: string;
    failModel?: string;
  } = {},
) {
  const txState = { active: false, usedAfterClose: false };
  const tx = transactionMock(txState, options);
  const transactionState = { rolledBack: false };
  const transaction = jest.fn(
    async (
      callback: (tx: ReturnType<typeof transactionMock>) => Promise<unknown>,
      options?: typeof LEGACY_IMPORT_TRANSACTION_OPTIONS,
    ) => {
      void options;
      txState.active = true;
      try {
        return await callback(tx);
      } catch (error) {
        transactionState.rolledBack = true;
        throw error;
      } finally {
        txState.active = false;
      }
    },
  );
  const rootDelegates = [
    delegate('rootCurrency', txState, { root: true }),
    delegate('rootCounterparty', txState, { root: true }),
    delegate('rootPlacement', txState, { root: true }),
  ];
  const prisma = {
    $transaction: transaction,
    currency: rootDelegates[0],
    counterparty: rootDelegates[1],
    placement: rootDelegates[2],
  } as unknown as PrismaClient;
  return { prisma, transaction, transactionState, tx, txState, rootDelegates };
}

function transactionMock(
  txState: { active: boolean; usedAfterClose: boolean },
  options: {
    existingMaps?: ExistingMaps;
    existingRiskTypeId?: string;
    failModel?: string;
  },
) {
  const maps = new Map<string, { currentId: string; currentModel: string }>();
  for (const [entityType, byLegacyId] of Object.entries(
    options.existingMaps ?? {},
  )) {
    for (const [legacyId, currentId] of Object.entries(byLegacyId)) {
      maps.set(`${entityType}:${legacyId}`, {
        currentId,
        currentModel: currentModelFor(entityType),
      });
    }
  }
  return {
    legacyImportRun: delegate('legacyImportRun', txState),
    legacyImportMap: legacyImportMapDelegate(txState, maps),
    currency: delegate('currency', txState, { failModel: options.failModel }),
    counterparty: delegate('counterparty', txState, {
      failModel: options.failModel,
    }),
    counterpartyAddress: delegate('counterpartyAddress', txState, {
      failModel: options.failModel,
    }),
    riskClass: delegate('riskClass', txState, { failModel: options.failModel }),
    riskType: delegate('riskType', txState, {
      existingRiskTypeId: options.existingRiskTypeId,
      failModel: options.failModel,
    }),
    riskTypeField: delegate('riskTypeField', txState, {
      failModel: options.failModel,
    }),
    placement: delegate('placement', txState, { failModel: options.failModel }),
    placementParticipant: delegate('placementParticipant', txState, {
      failModel: options.failModel,
    }),
  };
}

function delegate(
  model: string,
  txState: { active: boolean; usedAfterClose: boolean },
  options: {
    existingRiskTypeId?: string;
    failModel?: string;
    root?: boolean;
  } = {},
): PrismaDelegate {
  const assertActive = () => {
    if (!options.root && !txState.active) txState.usedAfterClose = true;
  };
  return {
    findFirst: jest.fn((_input: unknown) => {
      void _input;
      assertActive();
      if (model === 'riskType' && options.existingRiskTypeId) {
        return Promise.resolve({ id: options.existingRiskTypeId });
      }
      return Promise.resolve(null);
    }),
    findUnique: jest.fn((_input: unknown) => {
      void _input;
      assertActive();
      return Promise.resolve(null);
    }),
    create: jest.fn((_input: unknown) => {
      void _input;
      assertActive();
      if (model === options.failModel) {
        return Promise.reject(new Error(`${model} create failed`));
      }
      return Promise.resolve({ id: `${model}-created` });
    }),
    update: jest.fn((_input: unknown) => {
      void _input;
      assertActive();
      return Promise.resolve({ id: `${model}-updated` });
    }),
  };
}

function legacyImportMapDelegate(
  txState: { active: boolean; usedAfterClose: boolean },
  maps: Map<string, { currentId: string; currentModel: string }>,
): PrismaDelegate {
  const base = delegate('legacyImportMap', txState);
  base.findUnique.mockImplementation((input: unknown) => {
    if (!txState.active) txState.usedAfterClose = true;
    const where = legacyImportMapWhere(input);
    const found = maps.get(`${where.entityType}:${where.legacyId}`);
    return Promise.resolve(
      found
        ? {
            ...found,
            rawHash: 'existing-hash',
          }
        : null,
    );
  });
  base.create.mockImplementation((input: unknown) => {
    if (!txState.active) txState.usedAfterClose = true;
    const data = legacyImportMapData(input);
    maps.set(`${data.entityType}:${data.legacyId}`, {
      currentId: data.currentId,
      currentModel: data.currentModel,
    });
    return Promise.resolve({ id: `map-${data.entityType}-${data.legacyId}` });
  });
  return base;
}

function findUniqueLookups(
  tx: ReturnType<typeof transactionMock>,
  entityType: string,
  legacyId: string,
) {
  return tx.legacyImportMap.findUnique.mock.calls.filter(([input]) => {
    const where = legacyImportMapWhere(input);
    return where.entityType === entityType && where.legacyId === legacyId;
  }).length;
}

function legacyImportMapWhere(input: unknown) {
  const record = input as {
    where: {
      tenantId_sourceSystem_entityType_legacyId: {
        entityType: string;
        legacyId: string;
      };
    };
  };
  return record.where.tenantId_sourceSystem_entityType_legacyId;
}

function legacyImportMapData(input: unknown) {
  const record = input as {
    data: {
      entityType: string;
      legacyId: string;
      currentModel: string;
      currentId: string;
    };
  };
  return record.data;
}

function currentModelFor(entityType: string) {
  const currentModels: Record<string, string> = {
    currency: 'Currency',
    classofbusiness: 'RiskClass',
    risk_type: 'RiskType',
    risk_type_field: 'RiskTypeField',
    insurer: 'Counterparty',
    reinsurer: 'Counterparty',
    counterparty_address: 'CounterpartyAddress',
    offer: 'Placement',
    offer_participant: 'PlacementParticipant',
  };
  return currentModels[entityType] ?? entityType;
}

function applyInput(sources: LegacyOffer[]) {
  const normalizer = new LegacyOffersNormalizer();
  const normalizedOffers = sources.map((source) =>
    normalizer.normalize(source),
  );
  const plan = new LegacyOffersPlanGenerator().build({
    tenantSlug: 'acme-ghana',
    tenantId: 'tenant-1',
    sourceFilePath: 'legacy-offers.json',
    sourceFileHash: 'file-hash',
    offers: sources,
    mode: 'apply',
    fixtureOfferIds: sources.map((source) => String(source.offer_id)),
  });
  return {
    tenantId: 'tenant-1',
    tenantSlug: 'acme-ghana',
    importUserId: 'user-1',
    sourceFilePath: 'legacy-offers.json',
    sourceFileHash: 'file-hash',
    plan,
    normalizedOffers,
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
      policy_number: `POL-${String(overrides.offer_id ?? '1')}`,
      insured_by: 'Insured',
      currency: 'GHS',
      offer_details: '[{"keydetail":"Vehicle Make","value":"Truck"}]',
    },
    offer_participant: [
      {
        offer_participant_id: `p${String(overrides.offer_id ?? '1')}`,
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
