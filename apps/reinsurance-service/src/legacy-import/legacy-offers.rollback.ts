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
      const riskTypeFieldIds = await filterIdsWithoutSurvivingImportMap(
        tx,
        tenantId,
        importRunId,
        'RiskTypeField',
        ids.RiskTypeField ?? [],
      );
      const deleted: Record<string, number> = {};

      deleted.placementClosings = await deleteMany(tx, 'placementClosing', {
        tenantId,
        id: { in: ids.PlacementClosing ?? [] },
      });
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
        id: { in: riskTypeFieldIds },
      });
      const riskTypeIds = await filterRiskTypeIdsSafeToDelete(
        tx,
        tenantId,
        importRunId,
        ids.RiskType ?? [],
      );
      deleted.riskTypes = await deleteMany(tx, 'riskType', {
        tenantId,
        id: { in: riskTypeIds },
      });
      const riskClassIds = await filterRiskClassIdsSafeToDelete(
        tx,
        tenantId,
        ids.RiskClass ?? [],
      );
      deleted.riskClasses = await deleteMany(tx, 'riskClass', {
        tenantId,
        id: { in: riskClassIds },
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
    acc[row.currentModel] = [
      ...new Set([...(acc[row.currentModel] ?? []), row.currentId]),
    ];
    return acc;
  }, {});
}

async function filterRiskTypeIdsSafeToDelete(
  tx: Prisma.TransactionClient,
  tenantId: string,
  importRunId: string,
  ids: string[],
) {
  const withoutSurvivingMaps = await filterIdsWithoutSurvivingImportMap(
    tx,
    tenantId,
    importRunId,
    'RiskType',
    ids,
  );
  if (withoutSurvivingMaps.length === 0) return [];
  const referencedPlacements = await tx.placement.findMany({
    where: {
      tenantId,
      riskTypeId: { in: withoutSurvivingMaps },
    },
    select: { riskTypeId: true },
  });
  const referencedRiskTypeIds = new Set(
    referencedPlacements
      .map((placement) => placement.riskTypeId)
      .filter((id): id is string => Boolean(id)),
  );
  return withoutSurvivingMaps.filter((id) => !referencedRiskTypeIds.has(id));
}

async function filterRiskClassIdsSafeToDelete(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ids: string[],
) {
  if (ids.length === 0) return [];
  const survivingRiskTypes = await tx.riskType.findMany({
    where: {
      tenantId,
      riskClassId: { in: ids },
    },
    select: { riskClassId: true },
  });
  const referencedRiskClassIds = new Set(
    survivingRiskTypes.map((riskType) => riskType.riskClassId),
  );
  return ids.filter((id) => !referencedRiskClassIds.has(id));
}

async function filterIdsWithoutSurvivingImportMap(
  tx: Prisma.TransactionClient,
  tenantId: string,
  importRunId: string,
  currentModel: string,
  ids: string[],
) {
  if (ids.length === 0) return [];
  const survivingMaps = await tx.legacyImportMap.findMany({
    where: {
      tenantId,
      sourceSystem: LEGACY_SOURCE_SYSTEM,
      currentModel,
      currentId: { in: ids },
      importRunId: { not: importRunId },
    },
    select: { currentId: true },
  });
  const survivingIds = new Set(survivingMaps.map((map) => map.currentId));
  return ids.filter((id) => !survivingIds.has(id));
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
