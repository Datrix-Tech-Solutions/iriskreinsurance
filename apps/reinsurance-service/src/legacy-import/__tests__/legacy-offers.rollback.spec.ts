import { PrismaClient } from '../../../prisma/generated/client';
import { LEGACY_SOURCE_SYSTEM } from '../legacy-import.types';
import { LegacyOffersRollback } from '../legacy-offers.rollback';

describe('LegacyOffersRollback', () => {
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
});

function prismaMock(maps: Array<{ currentModel: string; currentId: string }>) {
  const tx = transactionMock(maps);
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
) {
  return {
    legacyImportMap: {
      findMany: jest.fn().mockResolvedValue(maps),
      deleteMany: jest.fn().mockResolvedValue({ count: maps.length }),
    },
    legacyImportRun: {
      update: jest.fn().mockResolvedValue({ id: 'run-1' }),
    },
    placementParticipant: delegate(),
    placement: delegate(),
    counterpartyAddress: delegate(),
    counterparty: delegate(),
    riskTypeField: delegate(),
    riskType: delegate(),
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
    importRunId: string;
    sourceSystem: string;
    createdByImport: boolean;
  };
  select: { currentModel: boolean; currentId: boolean };
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
