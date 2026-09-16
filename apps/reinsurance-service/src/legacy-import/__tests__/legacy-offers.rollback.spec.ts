import { PrismaClient } from '../../../prisma/generated/client';
import { LEGACY_SOURCE_SYSTEM } from '../legacy-import.types';
import { LegacyOffersRollback } from '../legacy-offers.rollback';

describe('LegacyOffersRollback', () => {
  it('deletes exact mapped placement closings before imported participants', async () => {
    const { prisma, tx } = prismaMock([
      map('PlacementClosing', 'closing-1'),
      map('PlacementParticipant', 'participant-1'),
    ]);

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.placementClosing.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['closing-1'] },
      },
    });
    const closingOrder =
      tx.placementClosing.deleteMany.mock.invocationCallOrder[0];
    const participantOrder =
      tx.placementParticipant.deleteMany.mock.invocationCallOrder[0];
    expect(closingOrder).toBeLessThan(participantOrder);
  });

  it('deletes exact mapped addresses and leaves unrelated addresses on imported counterparties alone', async () => {
    const { prisma, tx } = prismaMock([
      map('Counterparty', 'counterparty-1'),
      map('CounterpartyAddress', 'imported-address-1'),
    ]);

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.counterpartyAddress.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['imported-address-1'] },
      },
    });
    expect(
      deleteManyCalls(tx.counterpartyAddress).some(
        (call) => 'counterpartyId' in call.where,
      ),
    ).toBe(false);
  });

  it('deletes exact mapped risk fields and leaves unrelated fields on imported risk types alone', async () => {
    const { prisma, tx } = prismaMock([
      map('RiskType', 'risk-type-1'),
      map('RiskTypeField', 'imported-field-1'),
    ]);

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.riskTypeField.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['imported-field-1'] },
      },
    });
    expect(
      deleteManyCalls(tx.riskTypeField).some(
        (call) => 'riskTypeId' in call.where,
      ),
    ).toBe(false);
  });

  it('only selects maps with createdByImport=true for business-row deletion', async () => {
    const { prisma, tx } = prismaMock([
      map('Placement', 'imported-placement'),
      map('Currency', 'imported-currency'),
    ]);

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.legacyImportMap.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        importRunId: 'run-1',
        sourceSystem: LEGACY_SOURCE_SYSTEM,
        createdByImport: true,
      },
      select: { currentModel: true, currentId: true },
    });
    expect(tx.placement.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['imported-placement'] },
      },
    });
    expect(tx.currency.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['imported-currency'] },
      },
    });
  });

  it('cannot delete business rows from another import run', async () => {
    const { prisma, tx } = prismaMock([
      map('Placement', 'run-1-placement'),
      map('Counterparty', 'run-1-counterparty'),
      map('CounterpartyAddress', 'run-1-address'),
    ]);

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(legacyMapFindManyCalls(tx)[0].where.importRunId).toBe('run-1');
    expect(tx.placement.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['run-1-placement'] },
      },
    });
    expect(tx.counterpartyAddress.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['run-1-address'] },
      },
    });
  });

  it('deletes exact mapped imported addresses and risk fields', async () => {
    const { prisma, tx } = prismaMock([
      map('Counterparty', 'counterparty-1'),
      map('CounterpartyAddress', 'address-1'),
      map('CounterpartyAddress', 'address-2'),
      map('RiskTypeField', 'field-1'),
      map('RiskTypeField', 'field-2'),
    ]);

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.counterpartyAddress.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['address-1', 'address-2'] },
      },
    });
    expect(tx.riskTypeField.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['field-1', 'field-2'] },
      },
    });
  });

  it('runs rollback in a single transaction', async () => {
    const { prisma, transaction } = prismaMock([]);

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('does not delete shared RiskType when a second alias map survives', async () => {
    const { prisma, tx } = prismaMock(
      [
        map('RiskClass', 'risk-class-bond'),
        map('RiskType', 'risk-type-shared'),
      ],
      {
        survivingMaps: [map('RiskType', 'risk-type-shared')],
        survivingRiskTypes: [{ riskClassId: 'risk-class-bond' }],
      },
    );

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.riskType.deleteMany).not.toHaveBeenCalled();
    expect(tx.riskClass.deleteMany).not.toHaveBeenCalled();
  });

  it('does not delete shared RiskTypeField when a second alias map survives', async () => {
    const { prisma, tx } = prismaMock(
      [map('RiskTypeField', 'risk-field-shared')],
      {
        survivingMaps: [map('RiskTypeField', 'risk-field-shared')],
      },
    );

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.riskTypeField.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes final alias RiskType and field when no surviving map or placement remains', async () => {
    const { prisma, tx } = prismaMock([
      map('RiskClass', 'risk-class-final'),
      map('RiskType', 'risk-type-final'),
      map('RiskTypeField', 'risk-field-final'),
    ]);

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.riskTypeField.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['risk-field-final'] },
      },
    });
    expect(tx.riskType.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['risk-type-final'] },
      },
    });
    expect(tx.riskClass.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['risk-class-final'] },
      },
    });
  });

  it('does not delete a RiskType still referenced by a surviving placement', async () => {
    const { prisma, tx } = prismaMock([map('RiskType', 'risk-type-shared')], {
      referencedPlacements: [{ riskTypeId: 'risk-type-shared' }],
    });

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.riskType.deleteMany).not.toHaveBeenCalled();
  });

  it('preserves a reference-only currency still used by a surviving placement', async () => {
    const { prisma, tx } = prismaMock([map('Currency', 'currency-ghs')], {
      currencies: [{ id: 'currency-ghs', isoCode: 'GHS' }],
      referencedCurrencyPlacements: [{ currency: 'GHS' }],
    });

    const result = await new LegacyOffersRollback(prisma).rollback(
      'run-1',
      'tenant-1',
    );

    expect(tx.currency.deleteMany).not.toHaveBeenCalled();
    expect(result.preserved).toContainEqual({
      currentModel: 'Currency',
      currentId: 'currency-ghs',
      reason: 'referenced-by-surviving-placement',
    });
  });

  it('deletes a reference-only currency with no surviving dependency', async () => {
    const { prisma, tx } = prismaMock([map('Currency', 'currency-usd')], {
      currencies: [{ id: 'currency-usd', isoCode: 'USD' }],
    });

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.currency.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['currency-usd'] },
      },
    });
  });

  it('preserves counterparty and address when surviving placement data references the counterparty', async () => {
    const { prisma, tx } = prismaMock(
      [
        map('Counterparty', 'counterparty-shared'),
        map('CounterpartyAddress', 'address-shared'),
      ],
      {
        addresses: [
          { id: 'address-shared', counterpartyId: 'counterparty-shared' },
        ],
        referencedCounterpartyPlacements: [{ cedantId: 'counterparty-shared' }],
      },
    );

    const result = await new LegacyOffersRollback(prisma).rollback(
      'run-1',
      'tenant-1',
    );

    expect(tx.counterparty.deleteMany).not.toHaveBeenCalled();
    expect(tx.counterpartyAddress.deleteMany).not.toHaveBeenCalled();
    expect(result.preserved).toEqual(
      expect.arrayContaining([
        {
          currentModel: 'Counterparty',
          currentId: 'counterparty-shared',
          reason: 'referenced-by-surviving-placement-data',
        },
        {
          currentModel: 'CounterpartyAddress',
          currentId: 'address-shared',
          reason: 'counterparty-preserved-or-not-owned-by-rollback',
        },
      ]),
    );
  });

  it('preserves RiskTypeField when its RiskType is preserved by surviving placement dependency', async () => {
    const { prisma, tx } = prismaMock(
      [
        map('RiskType', 'risk-type-shared'),
        map('RiskTypeField', 'field-shared'),
      ],
      {
        riskFields: [{ id: 'field-shared', riskTypeId: 'risk-type-shared' }],
        referencedPlacements: [{ riskTypeId: 'risk-type-shared' }],
      },
    );

    const result = await new LegacyOffersRollback(prisma).rollback(
      'run-1',
      'tenant-1',
    );

    expect(tx.riskType.deleteMany).not.toHaveBeenCalled();
    expect(tx.riskTypeField.deleteMany).not.toHaveBeenCalled();
    expect(result.preserved).toContainEqual({
      currentModel: 'RiskTypeField',
      currentId: 'field-shared',
      reason: 'risk-type-referenced-by-surviving-placement',
    });
  });

  it('deduplicates shared delete targets within one rollback run', async () => {
    const { prisma, tx } = prismaMock([
      map('RiskType', 'risk-type-shared'),
      map('RiskType', 'risk-type-shared'),
      map('RiskTypeField', 'risk-field-shared'),
      map('RiskTypeField', 'risk-field-shared'),
    ]);

    await new LegacyOffersRollback(prisma).rollback('run-1', 'tenant-1');

    expect(tx.riskType.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['risk-type-shared'] },
      },
    });
    expect(tx.riskTypeField.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['risk-field-shared'] },
      },
    });
  });
});

function prismaMock(
  maps: Array<{ currentModel: string; currentId: string }>,
  options: {
    survivingMaps?: Array<{ currentModel: string; currentId: string }>;
    referencedPlacements?: Array<{ riskTypeId: string | null }>;
    referencedCurrencyPlacements?: Array<{ currency: string }>;
    referencedCounterpartyPlacements?: Array<{ cedantId: string }>;
    survivingRiskTypes?: Array<{ riskClassId: string }>;
    currencies?: Array<{ id: string; isoCode: string }>;
    addresses?: Array<{ id: string; counterpartyId: string }>;
    riskFields?: Array<{ id: string; riskTypeId: string }>;
  } = {},
) {
  const tx = transactionMock(maps, options);
  const transaction = jest.fn(
    (callback: (tx: ReturnType<typeof transactionMock>) => Promise<unknown>) =>
      callback(tx),
  );
  const prisma = {
    $transaction: transaction,
  } as unknown as PrismaClient;
  return { prisma, tx, transaction };
}

function transactionMock(
  maps: Array<{ currentModel: string; currentId: string }>,
  options: {
    survivingMaps?: Array<{ currentModel: string; currentId: string }>;
    referencedPlacements?: Array<{ riskTypeId: string | null }>;
    referencedCurrencyPlacements?: Array<{ currency: string }>;
    referencedCounterpartyPlacements?: Array<{ cedantId: string }>;
    survivingRiskTypes?: Array<{ riskClassId: string }>;
    currencies?: Array<{ id: string; isoCode: string }>;
    addresses?: Array<{ id: string; counterpartyId: string }>;
    riskFields?: Array<{ id: string; riskTypeId: string }>;
  } = {},
) {
  const emptyFindMany = jest.fn().mockResolvedValue([]);
  const riskFields =
    options.riskFields ??
    [
      ...new Set(
        maps
          .filter((item) => item.currentModel === 'RiskTypeField')
          .map((item) => item.currentId),
      ),
    ].map((id) => ({
      id,
      riskTypeId: 'risk-type-unreferenced',
    }));
  const currencies =
    options.currencies ??
    maps
      .filter((item) => item.currentModel === 'Currency')
      .map((item) => ({
        id: item.currentId,
        isoCode: item.currentId,
      }));
  const counterpartyIds = new Set(
    maps
      .filter((item) => item.currentModel === 'Counterparty')
      .map((item) => item.currentId),
  );
  const addresses =
    options.addresses ??
    maps
      .filter((item) => item.currentModel === 'CounterpartyAddress')
      .map((item) => ({
        id: item.currentId,
        counterpartyId:
          [...counterpartyIds].find((id) =>
            item.currentId.toLowerCase().includes(id.toLowerCase()),
          ) ??
          (counterpartyIds.size === 1
            ? [...counterpartyIds][0]
            : 'counterparty-unreferenced'),
      }));
  return {
    legacyImportMap: {
      findMany: jest.fn((input: LegacyMapFindManyInput) => {
        if ('createdByImport' in input.where) return Promise.resolve(maps);
        return Promise.resolve(
          (options.survivingMaps ?? []).filter(
            (map) =>
              map.currentModel === input.where.currentModel &&
              input.where.currentId.in.includes(map.currentId),
          ),
        );
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: maps.length }),
    },
    legacyImportRun: {
      update: jest.fn().mockResolvedValue({ id: 'run-1' }),
    },
    placementParticipant: delegate(),
    placementClosing: delegate(),
    placement: {
      ...delegate(),
      findMany: jest.fn((input: { where?: Record<string, unknown> }) => {
        if (input.where && 'riskTypeId' in input.where) {
          return Promise.resolve(options.referencedPlacements ?? []);
        }
        if (input.where && 'currency' in input.where) {
          return Promise.resolve(options.referencedCurrencyPlacements ?? []);
        }
        if (input.where && 'cedantId' in input.where) {
          return Promise.resolve(
            options.referencedCounterpartyPlacements ?? [],
          );
        }
        return Promise.resolve([]);
      }),
    },
    counterpartyAddress: {
      ...delegate(),
      findMany: jest.fn().mockResolvedValue(addresses),
    },
    counterparty: delegate(),
    riskTypeField: {
      ...delegate(),
      findMany: jest.fn().mockResolvedValue(riskFields),
    },
    riskType: {
      ...delegate(),
      findMany: jest.fn().mockResolvedValue(options.survivingRiskTypes ?? []),
    },
    riskClass: delegate(),
    currency: {
      ...delegate(),
      findMany: jest.fn().mockResolvedValue(currencies),
    },
    placementPayment: { findMany: emptyFindMany },
    placementNote: { findMany: emptyFindMany },
    placementClaimAllocation: { findMany: emptyFindMany },
    placementClaimCashCall: { findMany: emptyFindMany },
    placementClaimRecoveryApproval: { findMany: emptyFindMany },
    placementClaimRecoveryReceipt: { findMany: emptyFindMany },
    placementEndorsementParticipant: { findMany: emptyFindMany },
  };
}

function delegate() {
  return {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockResolvedValue([]),
  };
}

type DeleteManyInput = { where: Record<string, unknown> };
type DeleteManyDelegate = {
  deleteMany: jest.Mock<Promise<{ count: number }>, [DeleteManyInput]>;
};
type LegacyMapFindManyInput = {
  where: {
    tenantId: string;
    importRunId: string | { not: string };
    sourceSystem: string;
    createdByImport?: boolean;
    currentModel?: string;
    currentId: { in: string[] };
  };
  select: Partial<Record<'currentModel' | 'currentId' | 'riskTypeId', boolean>>;
};
type TransactionMock = ReturnType<typeof transactionMock>;

function deleteManyCalls(delegate: DeleteManyDelegate): DeleteManyInput[] {
  return delegate.deleteMany.mock.calls.map(([input]) => input);
}

function legacyMapFindManyCalls(tx: TransactionMock): LegacyMapFindManyInput[] {
  const findMany = tx.legacyImportMap.findMany as jest.Mock<
    Promise<Array<{ currentModel: string; currentId: string }>>,
    [LegacyMapFindManyInput]
  >;
  return findMany.mock.calls.map(([input]) => input);
}

function map(currentModel: string, currentId: string) {
  return { currentModel, currentId };
}
