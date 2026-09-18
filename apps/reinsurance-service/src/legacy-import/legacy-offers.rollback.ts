import { Prisma, PrismaClient } from '../../prisma/generated/client';
import { LEGACY_SOURCE_SYSTEM } from './legacy-import.types';

export type RollbackLegacyImportResult = {
  importRunId: string;
  deleted: Record<string, number>;
  preserved: Array<{ currentModel: string; currentId: string; reason: string }>;
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
      const preserved: RollbackLegacyImportResult['preserved'] = [];

      deleted.paymentAllocations = await deleteMany(
        tx,
        'placementPaymentAllocation',
        {
          tenantId,
          id: { in: ids.PlacementPaymentAllocation ?? [] },
        },
      );
      deleted.placementPayments = await deleteMany(tx, 'placementPayment', {
        tenantId,
        id: { in: ids.PlacementPayment ?? [] },
      });
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
      const counterpartyIds = await filterCounterpartyIdsSafeToDelete(
        tx,
        tenantId,
        importRunId,
        ids.Counterparty ?? [],
        preserved,
      );
      const counterpartyAddressIds =
        await filterCounterpartyAddressIdsSafeToDelete(
          tx,
          tenantId,
          importRunId,
          ids.CounterpartyAddress ?? [],
          counterpartyIds,
          preserved,
        );
      deleted.counterpartyAddresses = await deleteMany(
        tx,
        'counterpartyAddress',
        {
          tenantId,
          id: { in: counterpartyAddressIds },
        },
      );
      deleted.counterparties = await deleteMany(tx, 'counterparty', {
        tenantId,
        id: { in: counterpartyIds },
      });
      const riskTypeIds = await filterRiskTypeIdsSafeToDelete(
        tx,
        tenantId,
        importRunId,
        ids.RiskType ?? [],
        preserved,
      );
      const riskTypeFieldIds = await filterRiskTypeFieldIdsSafeToDelete(
        tx,
        tenantId,
        importRunId,
        ids.RiskTypeField ?? [],
        preserved,
      );
      deleted.riskTypeFields = await deleteMany(tx, 'riskTypeField', {
        tenantId,
        id: { in: riskTypeFieldIds },
      });
      deleted.riskTypes = await deleteMany(tx, 'riskType', {
        tenantId,
        id: { in: riskTypeIds },
      });
      const riskClassIds = await filterRiskClassIdsSafeToDelete(
        tx,
        tenantId,
        ids.RiskClass ?? [],
        preserved,
      );
      deleted.riskClasses = await deleteMany(tx, 'riskClass', {
        tenantId,
        id: { in: riskClassIds },
      });
      const currencyIds = await filterCurrencyIdsSafeToDelete(
        tx,
        tenantId,
        importRunId,
        ids.Currency ?? [],
        preserved,
      );
      deleted.currencies = await deleteMany(tx, 'currency', {
        tenantId,
        id: { in: currencyIds },
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
          summary: {
            rollbackDeleted: deleted,
            rollbackPreserved: preserved,
          } as Prisma.InputJsonValue,
        },
      });

      return { importRunId, deleted, preserved };
    });
  }
}

async function filterCurrencyIdsSafeToDelete(
  tx: Prisma.TransactionClient,
  tenantId: string,
  importRunId: string,
  ids: string[],
  preserved: RollbackLegacyImportResult['preserved'],
) {
  const withoutSurvivingMaps = await filterIdsWithoutSurvivingImportMap(
    tx,
    tenantId,
    importRunId,
    'Currency',
    ids,
    preserved,
  );
  if (withoutSurvivingMaps.length === 0) return [];
  const currencies = await tx.currency.findMany({
    where: { tenantId, id: { in: withoutSurvivingMaps } },
    select: { id: true, isoCode: true },
  });
  const referencedPlacements = await tx.placement.findMany({
    where: {
      tenantId,
      currency: { in: currencies.map((currency) => currency.isoCode) },
    },
    select: { currency: true },
  });
  const referencedIsoCodes = new Set(
    referencedPlacements.map((placement) => placement.currency),
  );
  return currencies
    .filter((currency) => {
      const referenced = referencedIsoCodes.has(currency.isoCode);
      if (referenced) {
        preserved.push({
          currentModel: 'Currency',
          currentId: currency.id,
          reason: 'referenced-by-surviving-placement',
        });
      }
      return !referenced;
    })
    .map((currency) => currency.id);
}

async function filterCounterpartyIdsSafeToDelete(
  tx: Prisma.TransactionClient,
  tenantId: string,
  importRunId: string,
  ids: string[],
  preserved: RollbackLegacyImportResult['preserved'],
) {
  const withoutSurvivingMaps = await filterIdsWithoutSurvivingImportMap(
    tx,
    tenantId,
    importRunId,
    'Counterparty',
    ids,
    preserved,
  );
  if (withoutSurvivingMaps.length === 0) return [];
  const referencedIds = await referencedCounterpartyIds(
    tx,
    tenantId,
    withoutSurvivingMaps,
  );
  return withoutSurvivingMaps.filter((id) => {
    const referenced = referencedIds.has(id);
    if (referenced) {
      preserved.push({
        currentModel: 'Counterparty',
        currentId: id,
        reason: 'referenced-by-surviving-placement-data',
      });
    }
    return !referenced;
  });
}

async function filterCounterpartyAddressIdsSafeToDelete(
  tx: Prisma.TransactionClient,
  tenantId: string,
  importRunId: string,
  ids: string[],
  deletableCounterpartyIds: string[],
  preserved: RollbackLegacyImportResult['preserved'],
) {
  const withoutSurvivingMaps = await filterIdsWithoutSurvivingImportMap(
    tx,
    tenantId,
    importRunId,
    'CounterpartyAddress',
    ids,
    preserved,
  );
  if (withoutSurvivingMaps.length === 0) return [];
  const addresses = await tx.counterpartyAddress.findMany({
    where: { tenantId, id: { in: withoutSurvivingMaps } },
    select: { id: true, counterpartyId: true },
  });
  const deletableCounterparties = new Set(deletableCounterpartyIds);
  return addresses
    .filter((address) => {
      const preserve = !deletableCounterparties.has(address.counterpartyId);
      if (preserve) {
        preserved.push({
          currentModel: 'CounterpartyAddress',
          currentId: address.id,
          reason: 'counterparty-preserved-or-not-owned-by-rollback',
        });
      }
      return !preserve;
    })
    .map((address) => address.id);
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
  preserved: RollbackLegacyImportResult['preserved'],
) {
  const withoutSurvivingMaps = await filterIdsWithoutSurvivingImportMap(
    tx,
    tenantId,
    importRunId,
    'RiskType',
    ids,
    preserved,
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
  return withoutSurvivingMaps.filter((id) => {
    const referenced = referencedRiskTypeIds.has(id);
    if (referenced) {
      preserved.push({
        currentModel: 'RiskType',
        currentId: id,
        reason: 'referenced-by-surviving-placement',
      });
    }
    return !referenced;
  });
}

async function filterRiskTypeFieldIdsSafeToDelete(
  tx: Prisma.TransactionClient,
  tenantId: string,
  importRunId: string,
  ids: string[],
  preserved: RollbackLegacyImportResult['preserved'],
) {
  const withoutSurvivingMaps = await filterIdsWithoutSurvivingImportMap(
    tx,
    tenantId,
    importRunId,
    'RiskTypeField',
    ids,
    preserved,
  );
  if (withoutSurvivingMaps.length === 0) return [];
  const fields = await tx.riskTypeField.findMany({
    where: { tenantId, id: { in: withoutSurvivingMaps } },
    select: { id: true, riskTypeId: true },
  });
  const referencedPlacements = await tx.placement.findMany({
    where: {
      tenantId,
      riskTypeId: { in: fields.map((field) => field.riskTypeId) },
    },
    select: { riskTypeId: true },
  });
  const referencedRiskTypeIds = new Set(
    referencedPlacements
      .map((placement) => placement.riskTypeId)
      .filter((id): id is string => Boolean(id)),
  );
  return fields
    .filter((field) => {
      const preserve = referencedRiskTypeIds.has(field.riskTypeId);
      if (preserve) {
        preserved.push({
          currentModel: 'RiskTypeField',
          currentId: field.id,
          reason: 'risk-type-referenced-by-surviving-placement',
        });
      }
      return !preserve;
    })
    .map((field) => field.id);
}

async function filterRiskClassIdsSafeToDelete(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ids: string[],
  preserved: RollbackLegacyImportResult['preserved'],
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
  return ids.filter((id) => {
    const referenced = referencedRiskClassIds.has(id);
    if (referenced) {
      preserved.push({
        currentModel: 'RiskClass',
        currentId: id,
        reason: 'referenced-by-surviving-risk-type',
      });
    }
    return !referenced;
  });
}

async function filterIdsWithoutSurvivingImportMap(
  tx: Prisma.TransactionClient,
  tenantId: string,
  importRunId: string,
  currentModel: string,
  ids: string[],
  preserved?: RollbackLegacyImportResult['preserved'],
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
  return ids.filter((id) => {
    const survives = survivingIds.has(id);
    if (survives) {
      preserved?.push({
        currentModel,
        currentId: id,
        reason: 'referenced-by-surviving-import-map',
      });
    }
    return !survives;
  });
}

async function referencedCounterpartyIds(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ids: string[],
) {
  const [
    placements,
    participants,
    payments,
    notes,
    claimAllocations,
    cashCalls,
    recoveryApprovals,
    recoveryReceipts,
    endorsementParticipants,
  ] = await Promise.all([
    tx.placement.findMany({
      where: { tenantId, cedantId: { in: ids } },
      select: { cedantId: true },
    }),
    tx.placementParticipant.findMany({
      where: { tenantId, counterpartyId: { in: ids } },
      select: { counterpartyId: true },
    }),
    tx.placementPayment.findMany({
      where: { tenantId, counterpartyId: { in: ids } },
      select: { counterpartyId: true },
    }),
    tx.placementNote.findMany({
      where: { tenantId, counterpartyId: { in: ids } },
      select: { counterpartyId: true },
    }),
    tx.placementClaimAllocation.findMany({
      where: { tenantId, counterpartyId: { in: ids } },
      select: { counterpartyId: true },
    }),
    tx.placementClaimCashCall.findMany({
      where: { tenantId, counterpartyId: { in: ids } },
      select: { counterpartyId: true },
    }),
    tx.placementClaimRecoveryApproval.findMany({
      where: { tenantId, counterpartyId: { in: ids } },
      select: { counterpartyId: true },
    }),
    tx.placementClaimRecoveryReceipt.findMany({
      where: { tenantId, counterpartyId: { in: ids } },
      select: { counterpartyId: true },
    }),
    tx.placementEndorsementParticipant.findMany({
      where: { tenantId, counterpartyId: { in: ids } },
      select: { counterpartyId: true },
    }),
  ]);
  return new Set([
    ...placements.map((row) => row.cedantId),
    ...participants.map((row) => row.counterpartyId),
    ...payments.map((row) => row.counterpartyId),
    ...notes.map((row) => row.counterpartyId),
    ...claimAllocations.map((row) => row.counterpartyId),
    ...cashCalls.map((row) => row.counterpartyId),
    ...recoveryApprovals.map((row) => row.counterpartyId),
    ...recoveryReceipts.map((row) => row.counterpartyId),
    ...endorsementParticipants.map((row) => row.counterpartyId),
  ]);
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
