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
    survivingRiskTypes?: Array<{ riskClassId: string }>;
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
    survivingRiskTypes?: Array<{ riskClassId: string }>;
  } = {},
) {
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
      findMany: jest.fn().mockResolvedValue(options.referencedPlacements ?? []),
    },
    counterpartyAddress: delegate(),
    counterparty: delegate(),
    riskTypeField: delegate(),
    riskType: {
      ...delegate(),
      findMany: jest.fn().mockResolvedValue(options.survivingRiskTypes ?? []),
    },
    riskClass: delegate(),
    currency: delegate(),
  };
}

function delegate() {
  return {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
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
