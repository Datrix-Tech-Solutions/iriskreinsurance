import { Prisma, PrismaClient } from '../../prisma/generated/client';
import { LEGACY_SOURCE_SYSTEM } from './legacy-import.types';

export type RollbackLegacyImportResult = {
  importRunId: string;
  deleted: Record<string, number>;
};

export class LegacyOffersRollback {
  constructor(private readonly prisma: PrismaClient) {}

  async rollback(
    importRunId: string,
    tenantId: string,
  ): Promise<RollbackLegacyImportResult> {
    return this.prisma.$transaction(async (tx) => {
      const maps = await tx.legacyImportMap.findMany({
        where: {
          tenantId,
          importRunId,
          sourceSystem: LEGACY_SOURCE_SYSTEM,
          createdByImport: true,
        },
        select: { currentModel: true, currentId: true },
      });
      const ids = byModel(maps);
      const deleted: Record<string, number> = {};

      deleted.placementParticipants = await deleteMany(
        tx,
        'placementParticipant',
        {
          tenantId,
          id: { in: ids.PlacementParticipant ?? [] },
        },
      );
      deleted.placements = await deleteMany(tx, 'placement', {
        tenantId,
        id: { in: ids.Placement ?? [] },
      });
      deleted.counterpartyAddresses = await deleteMany(
        tx,
        'counterpartyAddress',
        {
          tenantId,
          id: { in: ids.CounterpartyAddress ?? [] },
        },
      );
      deleted.counterparties = await deleteMany(tx, 'counterparty', {
        tenantId,
        id: { in: ids.Counterparty ?? [] },
      });
      deleted.riskTypeFields = await deleteMany(tx, 'riskTypeField', {
        tenantId,
        id: { in: ids.RiskTypeField ?? [] },
      });
      deleted.riskTypes = await deleteMany(tx, 'riskType', {
        tenantId,
        id: { in: ids.RiskType ?? [] },
      });
      deleted.riskClasses = await deleteMany(tx, 'riskClass', {
        tenantId,
        id: { in: ids.RiskClass ?? [] },
      });
      deleted.currencies = await deleteMany(tx, 'currency', {
        tenantId,
        id: { in: ids.Currency ?? [] },
      });
      deleted.legacyImportMaps = (
        await tx.legacyImportMap.deleteMany({
          where: { tenantId, importRunId, sourceSystem: LEGACY_SOURCE_SYSTEM },
        })
      ).count;
      await tx.legacyImportRun.update({
        where: { id: importRunId },
        data: {
          status: 'ROLLED_BACK',
          finishedAt: new Date(),
          summary: { rollbackDeleted: deleted } as Prisma.InputJsonValue,
        },
      });

      return { importRunId, deleted };
    });
  }
}

function byModel(rows: Array<{ currentModel: string; currentId: string }>) {
  return rows.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.currentModel] = [...(acc[row.currentModel] ?? []), row.currentId];
    return acc;
  }, {});
}

async function deleteMany(
  tx: Prisma.TransactionClient,
  model: keyof Prisma.TransactionClient,
  where: Record<string, unknown>,
) {
  const ids = Object.values(where).find((value): value is { in: string[] } =>
    Boolean(value && typeof value === 'object' && 'in' in value),
  );
  if (ids && ids.in.length === 0) return 0;
  const delegate = tx[model] as unknown as {
    deleteMany(input: {
      where: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
  return (await delegate.deleteMany({ where })).count;
}
