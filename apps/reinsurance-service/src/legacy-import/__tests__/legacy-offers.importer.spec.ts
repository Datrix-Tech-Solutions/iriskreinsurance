import { PrismaClient } from '../../../prisma/generated/client';
import {
  LEGACY_IMPORT_TRANSACTION_OPTIONS,
  LegacyOffersImporter,
} from '../legacy-offers.importer';
import { riskFieldDefinitionHash } from '../legacy-hash';
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

  it('uses only the transaction client for business writes', async () => {
    const { prisma, rootDelegates, tx } = prismaMock();

    await new LegacyOffersImporter(prisma).apply(applyInput([offer()]));

    for (const delegate of rootDelegates) {
      expect(delegate.create).not.toHaveBeenCalled();
      expect(delegate.findFirst).not.toHaveBeenCalled();
      expect(delegate.findUnique).not.toHaveBeenCalled();
      expect(delegate.findMany).not.toHaveBeenCalled();
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

  it('preserves idempotency when exact import maps already exist', async () => {
    const source = offer();
    const input = applyInput([source]);
    const normalized = input.normalizedOffers[0];
    const { prisma, tx } = prismaMock({
      existingMaps: {
        currency: { GHS: 'currency-existing' },
        risk_type: { '1': 'risk-type-existing' },
        insurer: { '15': 'cedant-existing' },
        reinsurer: { r1: 'reinsurer-existing' },
        offer: { [normalized.offerId]: 'placement-existing' },
        offer_participant: {
          [normalized.participants[0].participantId]: 'participant-existing',
        },
      },
    });

    const result = await new LegacyOffersImporter(prisma).apply(input);

    expect(result.created.legacyImportMaps).toBe(0);
    expect(result.created.placements).toBe(0);
    expect(result.created.participants).toBe(0);
    expect(tx.currency.create).not.toHaveBeenCalled();
    expect(tx.counterparty.create).not.toHaveBeenCalled();
    expect(tx.riskClass.create).not.toHaveBeenCalled();
    expect(tx.riskType.create).not.toHaveBeenCalled();
    expect(tx.placement.create).not.toHaveBeenCalled();
    expect(tx.placementParticipant.create).not.toHaveBeenCalled();
  });

  it('reports the exact number of import maps created for a fresh fixture', async () => {
    const { prisma, tx } = prismaMock();

    const result = await new LegacyOffersImporter(prisma).apply(
      applyInput([offer()]),
    );

    expect(result.created.legacyImportMaps).toBe(8);
    expect(tx.legacyImportMap.create).toHaveBeenCalledTimes(8);
  });

  it('caches import maps created earlier in the same transaction', async () => {
    const sources = [offer({ offer_id: '1' }), offer({ offer_id: '2' })];
    const { prisma, tx } = prismaMock();

    const result = await new LegacyOffersImporter(prisma).apply(
      applyInput(sources),
    );

    const currencyLookups = findUniqueLookups(tx, 'currency', 'GHS');
    const cedantLookups = findUniqueLookups(tx, 'insurer', '15');
    expect(currencyLookups).toBe(1);
    expect(cedantLookups).toBe(1);
    expect(mapCreates(tx, 'currency', 'GHS')).toBe(1);
    expect(mapCreates(tx, 'insurer', '15')).toBe(1);
    expect(result.created.legacyImportMaps).toBe(
      tx.legacyImportMap.create.mock.calls.length,
    );
  });

  it('writes risk-field definition hashes without occurrence values', async () => {
    const source = offer({
      offer_detail: {
        policy_number: 'POL-1',
        insured_by: 'Insured',
        currency: 'GHS',
        offer_details: '[{"keydetail":"Vehicle Make","value":"Truck"}]',
      },
    });
    const { prisma, tx } = prismaMock();

    await new LegacyOffersImporter(prisma).apply(applyInput([source]));

    const riskFieldMapCreate = tx.legacyImportMap.create.mock.calls.find(
      ([input]) =>
        legacyImportMapData(input).entityType === 'risk_type_field' &&
        legacyImportMapData(input).legacyId === '1:vehicle_make',
    );
    expect(riskFieldMapCreate).toBeDefined();
    expect(legacyImportMapData(riskFieldMapCreate![0]).rawHash).toBe(
      riskFieldDefinitionHash({
        riskTypeLegacyId: '1',
        key: 'Vehicle Make',
        normalizedKey: 'vehicle_make',
      }),
    );
  });

  it('maps Motor Comprehensive to RiskClass Motor and RiskType Motor Comprehensive', async () => {
    const { prisma, tx } = prismaMock();

    await new LegacyOffersImporter(prisma).apply(
      applyInput([
        offer({
          classofbusiness: {
            class_of_business_id: '1',
            business_name: 'Motor Comprehensive',
            business_details: '[{"keydetail":"Vehicle Make"}]',
          },
        }),
      ]),
    );

    expect(createData(tx.riskClass).name).toBe('Motor');
    expect(createData(tx.riskType)).toEqual(
      expect.objectContaining({
        riskClassId: 'riskClass-created-1',
        name: 'Motor Comprehensive',
      }),
    );
  });

  it('maps Performance Bond to RiskClass Bond', async () => {
    const { prisma, tx } = prismaMock();

    await new LegacyOffersImporter(prisma).apply(
      applyInput([
        offer({
          classofbusiness: {
            class_of_business_id: '40',
            business_name: 'Performance Bond',
            business_details: '[{"keydetail":"Bond Description"}]',
          },
        }),
      ]),
    );

    expect(createData(tx.riskClass).name).toBe('Bond');
    expect(createData(tx.riskType).name).toBe('Performance Bond');
  });

  it('creates or reuses one parent RiskClass for multiple mapped RiskTypes', async () => {
    const { prisma, tx } = prismaMock();

    await new LegacyOffersImporter(prisma).apply(
      applyInput([
        offer({
          offer_id: '1',
          classofbusiness: {
            class_of_business_id: '40',
            business_name: 'Performance Bond',
            business_details: '[{"keydetail":"Bond Description"}]',
          },
        }),
        offer({
          offer_id: '2',
          classofbusiness: {
            class_of_business_id: '41',
            business_name: 'Advance Payment Bond',
            business_details: '[{"keydetail":"Bond Description"}]',
          },
          offer_detail: {
            policy_number: 'POL-2',
            insured_by: 'Insured',
            currency: 'GHS',
            offer_details:
              '[{"keydetail":"Bond Description","value":"Advance"}]',
          },
        }),
      ]),
    );

    expect(tx.riskClass.create).toHaveBeenCalledTimes(1);
    expect(tx.riskType.create).toHaveBeenCalledTimes(2);
    expect(mapCreates(tx, 'risk_class', 'bond')).toBe(1);
  });

  it('keeps RiskType fields attached to the matching RiskType', async () => {
    const { prisma, tx } = prismaMock();

    await new LegacyOffersImporter(prisma).apply(
      applyInput([
        offer({
          offer_id: '1',
          classofbusiness: {
            class_of_business_id: '1',
            business_name: 'Motor Comprehensive',
            business_details: '[{"keydetail":"Description"}]',
          },
          offer_detail: {
            policy_number: 'POL-1',
            insured_by: 'Insured',
            currency: 'GHS',
            offer_details: '[{"keydetail":"Description","value":"Motor"}]',
          },
        }),
        offer({
          offer_id: '2',
          classofbusiness: {
            class_of_business_id: '40',
            business_name: 'Performance Bond',
            business_details: '[{"keydetail":"Description"}]',
          },
          offer_detail: {
            policy_number: 'POL-2',
            insured_by: 'Insured',
            currency: 'GHS',
            offer_details: '[{"keydetail":"Description","value":"Bond"}]',
          },
        }),
      ]),
    );

    expect(createData(tx.riskTypeField, 0)).toEqual(
      expect.objectContaining({
        riskTypeId: 'riskType-created-1',
        fieldKey: 'description',
      }),
    );
    expect(createData(tx.riskTypeField, 1)).toEqual(
      expect.objectContaining({
        riskTypeId: 'riskType-created-2',
        fieldKey: 'description',
      }),
    );
  });

  it('does not create risk taxonomy rows when exact maps already exist', async () => {
    const { prisma, tx } = prismaMock({
      existingMaps: {
        risk_class: { motor: 'risk-class-existing' },
        risk_type: { '1': 'risk-type-existing' },
        offer: { '1': 'placement-existing' },
      },
    });

    const result = await new LegacyOffersImporter(prisma).apply(
      applyInput([
        offer({
          classofbusiness: {
            class_of_business_id: '1',
            business_name: 'Motor Comprehensive',
            business_details: '[{"keydetail":"Vehicle Make"}]',
          },
        }),
      ]),
    );

    expect(result.created.riskClasses).toBe(0);
    expect(result.created.riskTypes).toBe(0);
    expect(tx.riskClass.create).not.toHaveBeenCalled();
    expect(tx.riskType.create).not.toHaveBeenCalled();
  });

  it('creates one current RiskType and separate same-run alias maps', async () => {
    const { prisma, tx } = prismaMock();

    const result = await new LegacyOffersImporter(prisma).apply(
      applyInput([retentionBondOffer('5', '1'), retentionBondOffer('30', '2')]),
    );

    expect(result.created.riskTypes).toBe(1);
    expect(tx.riskType.create).toHaveBeenCalledTimes(1);
    expect(mapCreates(tx, 'risk_type', '5')).toBe(1);
    expect(mapCreates(tx, 'risk_type', '30')).toBe(1);
    expect(mapCurrentIds(tx, 'risk_type')).toEqual([
      'riskType-created-1',
      'riskType-created-1',
    ]);
  });

  it('reuses an alias RiskType created by a separate import run', async () => {
    const { prisma, tx } = prismaMock({
      existingMaps: {
        risk_class: { bond: 'risk-class-bond' },
        risk_type: { '5': 'risk-type-retention-bond' },
      },
      existingRecords: {
        riskClass: [{ id: 'risk-class-bond', name: 'Bond' }],
        riskType: [
          {
            id: 'risk-type-retention-bond',
            tenantId: 'tenant-1',
            riskClassId: 'risk-class-bond',
            name: 'Retention Bond',
            archivedAt: null,
          },
        ],
      },
    });

    const result = await new LegacyOffersImporter(prisma).apply(
      applyInput([retentionBondOffer('30', '2')]),
    );

    expect(result.created.riskTypes).toBe(0);
    expect(tx.riskType.create).not.toHaveBeenCalled();
    expect(mapCreates(tx, 'risk_type', '30')).toBe(1);
    expect(mapCurrentIds(tx, 'risk_type')).toEqual([
      'risk-type-retention-bond',
    ]);
  });

  it('unions fields across aliased legacy RiskTypes', async () => {
    const { prisma, tx } = prismaMock();

    const result = await new LegacyOffersImporter(prisma).apply(
      applyInput([
        customsTransitBondOffer('44', '1'),
        customsTransitBondOffer('65', '2'),
      ]),
    );

    expect(result.created.riskTypes).toBe(1);
    expect(result.created.riskTypeFields).toBe(5);
    expect(riskTypeFieldCreateKeys(tx)).toEqual([
      'transit',
      'obligee_authority',
      'nature_of_goods',
      'description_of_bond',
      'obligee_employer',
    ]);
    expect(mapCreates(tx, 'risk_type', '44')).toBe(1);
    expect(mapCreates(tx, 'risk_type', '65')).toBe(1);
  });

  it('creates separate shared-field alias maps without double-creating fields', async () => {
    const { prisma, tx } = prismaMock();

    const result = await new LegacyOffersImporter(prisma).apply(
      applyInput([retentionBondOffer('5', '1'), retentionBondOffer('30', '2')]),
    );

    expect(result.created.riskTypeFields).toBe(2);
    expect(mapCreates(tx, 'risk_type_field', '5:project_description')).toBe(1);
    expect(mapCreates(tx, 'risk_type_field', '30:project_description')).toBe(1);
    expect(mapCurrentIds(tx, 'risk_type_field')).toEqual([
      'riskTypeField-created-1',
      'riskTypeField-created-2',
      'riskTypeField-created-1',
      'riskTypeField-created-2',
    ]);
  });

  it('does not recreate exact alias maps on an idempotent rerun', async () => {
    const { prisma, tx } = prismaMock({
      existingMaps: {
        risk_class: { bond: 'risk-class-bond' },
        risk_type: { '5': 'risk-type-retention-bond' },
        risk_type_field: {
          '5:project_description': 'field-project',
          '5:obligee_interest': 'field-obligee',
        },
        offer: { '1': 'placement-existing' },
      },
    });

    const result = await new LegacyOffersImporter(prisma).apply(
      applyInput([retentionBondOffer('5', '1')]),
    );

    expect(result.created.riskTypes).toBe(0);
    expect(result.created.riskTypeFields).toBe(0);
    expect(tx.riskType.create).not.toHaveBeenCalled();
    expect(tx.riskTypeField.create).not.toHaveBeenCalled();
    expect(mapCreates(tx, 'risk_type', '5')).toBe(0);
    expect(mapCreates(tx, 'risk_type_field', '5:project_description')).toBe(0);
  });
});

type ExistingMaps = Record<string, Record<string, string>>;
type ExistingRecords = Record<string, Array<Record<string, unknown>>>;
type TxState = { active: boolean; usedAfterClose: boolean };
type MockState = {
  maps: Map<string, { currentId: string; currentModel: string }>;
  counters: Map<string, number>;
  records: Map<string, Array<Record<string, unknown>>>;
};
type PrismaDelegate = {
  findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  findMany: jest.Mock<Promise<unknown[]>, [unknown]>;
  findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  create: jest.Mock<Promise<Record<string, unknown>>, [unknown]>;
  update: jest.Mock<Promise<Record<string, unknown>>, [unknown]>;
};

function prismaMock(
  options: {
    existingMaps?: ExistingMaps;
    existingRecords?: ExistingRecords;
    failModel?: string;
  } = {},
) {
  const txState: TxState = { active: false, usedAfterClose: false };
  const state: MockState = {
    maps: new Map(),
    counters: new Map(),
    records: new Map(),
  };
  for (const [model, records] of Object.entries(
    options.existingRecords ?? {},
  )) {
    state.records.set(model, records);
  }
  for (const [entityType, byLegacyId] of Object.entries(
    options.existingMaps ?? {},
  )) {
    for (const [legacyId, currentId] of Object.entries(byLegacyId)) {
      state.maps.set(`${entityType}:${legacyId}`, {
        currentId,
        currentModel: currentModelFor(entityType),
      });
    }
  }

  const tx = transactionMock(txState, state, options);
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
    delegate('rootCurrency', txState, state, { root: true }),
    delegate('rootCounterparty', txState, state, { root: true }),
    delegate('rootPlacement', txState, state, { root: true }),
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
  txState: TxState,
  state: MockState,
  options: { failModel?: string },
) {
  return {
    legacyImportRun: delegate('legacyImportRun', txState, state, options),
    legacyImportMap: legacyImportMapDelegate(txState, state),
    currency: delegate('currency', txState, state, options),
    counterparty: delegate('counterparty', txState, state, options),
    counterpartyAddress: delegate(
      'counterpartyAddress',
      txState,
      state,
      options,
    ),
    riskClass: delegate('riskClass', txState, state, options),
    riskType: delegate('riskType', txState, state, options),
    riskTypeField: delegate('riskTypeField', txState, state, options),
    placement: delegate('placement', txState, state, options),
    placementParticipant: delegate(
      'placementParticipant',
      txState,
      state,
      options,
    ),
  };
}

function delegate(
  model: string,
  txState: TxState,
  state: MockState,
  options: {
    failModel?: string;
    root?: boolean;
  } = {},
): PrismaDelegate {
  const assertActive = () => {
    if (!options.root && !txState.active) txState.usedAfterClose = true;
  };
  return {
    findFirst: jest.fn((input: unknown) => {
      assertActive();
      const where = (input as { where?: Record<string, unknown> }).where;
      if (where?.id) {
        return Promise.resolve(
          findRecord(state.records.get(model) ?? [], where) ?? { id: where.id },
        );
      }
      return Promise.resolve(findRecord(state.records.get(model) ?? [], where));
    }),
    findMany: jest.fn((input: unknown) => {
      assertActive();
      const where = (input as { where?: Record<string, unknown> }).where;
      return Promise.resolve(
        (state.records.get(model) ?? []).filter((record) =>
          matchesWhere(record, where),
        ),
      );
    }),
    findUnique: jest.fn((_input: unknown) => {
      void _input;
      assertActive();
      return Promise.resolve(null);
    }),
    create: jest.fn((input: unknown) => {
      assertActive();
      if (model === options.failModel) {
        return Promise.reject(new Error(`${model} create failed`));
      }
      const next = (state.counters.get(model) ?? 0) + 1;
      state.counters.set(model, next);
      const id = `${model}-created-${next}`;
      const record = {
        id,
        ...(input as { data?: Record<string, unknown> }).data,
      };
      state.records.set(model, [...(state.records.get(model) ?? []), record]);
      return Promise.resolve(record);
    }),
    update: jest.fn((input: unknown) => {
      assertActive();
      return Promise.resolve({
        id: `${model}-updated`,
        ...(input as { data?: Record<string, unknown> }).data,
      });
    }),
  };
}

function legacyImportMapDelegate(
  txState: TxState,
  state: MockState,
): PrismaDelegate {
  const base = delegate('legacyImportMap', txState, state);
  base.findUnique.mockImplementation((input: unknown) => {
    if (!txState.active) txState.usedAfterClose = true;
    const where = legacyImportMapWhere(input);
    const found = state.maps.get(`${where.entityType}:${where.legacyId}`);
    return Promise.resolve(
      found ? { ...found, rawHash: 'existing-hash' } : null,
    );
  });
  base.create.mockImplementation((input: unknown) => {
    if (!txState.active) txState.usedAfterClose = true;
    const data = legacyImportMapData(input);
    state.maps.set(`${data.entityType}:${data.legacyId}`, {
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

function mapCreates(
  tx: ReturnType<typeof transactionMock>,
  entityType: string,
  legacyId: string,
) {
  return tx.legacyImportMap.create.mock.calls.filter(([input]) => {
    const data = legacyImportMapData(input);
    return data.entityType === entityType && data.legacyId === legacyId;
  }).length;
}

function mapCurrentIds(
  tx: ReturnType<typeof transactionMock>,
  entityType: string,
) {
  return tx.legacyImportMap.create.mock.calls
    .filter(([input]) => legacyImportMapData(input).entityType === entityType)
    .map(([input]) => legacyImportMapData(input).currentId);
}

function riskTypeFieldCreateKeys(tx: ReturnType<typeof transactionMock>) {
  return tx.riskTypeField.create.mock.calls.map(
    ([input]) =>
      ((input as { data?: Record<string, unknown> }).data ?? {}).fieldKey,
  );
}

function createData(model: PrismaDelegate, callIndex = 0) {
  const input = model.create.mock.calls[callIndex]?.[0] as {
    data?: Record<string, unknown>;
  };
  return input.data ?? {};
}

function findRecord(
  records: Array<Record<string, unknown>>,
  where?: Record<string, unknown>,
) {
  return records.find((record) => matchesWhere(record, where)) ?? null;
}

function matchesWhere(
  record: Record<string, unknown>,
  where?: Record<string, unknown>,
) {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && 'in' in value) {
      return (value as { in: unknown[] }).in.includes(record[key]);
    }
    if (value === null)
      return record[key] === null || record[key] === undefined;
    return record[key] === value;
  });
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
      rawHash: string;
    };
  };
  return record.data;
}

function currentModelFor(entityType: string) {
  const currentModels: Record<string, string> = {
    currency: 'Currency',
    risk_class: 'RiskClass',
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

function customsTransitBondOffer(classId: '44' | '65', offerId: string) {
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
