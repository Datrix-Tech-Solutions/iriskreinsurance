import { PrismaClient } from '../../../prisma/generated/client';
import { LegacyClosedDateLookupReader } from '../legacy-closed-date-lookup.reader';
import { LegacyDbAwareDryRun } from '../legacy-db-aware-dry-run';
import { LegacyOffersImporter } from '../legacy-offers.importer';
import {
  selectLegacyOffersForImport,
  validateApplySelection,
} from '../legacy-offers.batch-selector';
import { LegacyOffersPlanGenerator } from '../legacy-offers.plan';
import { LegacyOffersReader } from '../legacy-offers.reader';
import { LegacyOffersRollback } from '../legacy-offers.rollback';
import {
  financialLegacyMapEntityTypes,
  LegacyFinancialPlan,
  LegacyFinancialPlanner,
  LegacyFinancialSourceOptions,
} from '../legacy-financials';
import {
  LEGACY_SOURCE_SYSTEM,
  LegacyImportMode,
  LegacyOfferClassification,
} from '../legacy-import.types';

type CliOptions = {
  source?: string;
  closedDateLookupFile?: string;
  tenantSlug: string;
  tenantId?: string;
  importUserId?: string;
  mode: LegacyImportMode;
  fixtureOfferIds: string[];
  classification?: LegacyOfferClassification;
  batchSize?: number;
  afterOfferId?: string;
  referenceOnly: boolean;
  allowApply: boolean;
  resolveDb: boolean;
  importRunId?: string;
  includeHistoricalFinancials: boolean;
  financialSourceDir?: string;
  offerCrosswalkFile?: string;
  participantCrosswalkFile?: string;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === 'rollback') {
    await rollback(options);
    return;
  }
  if (!options.source) {
    throw new Error('--source-file is required for dry-run and apply modes.');
  }

  const reader = new LegacyOffersReader();
  const file = await reader.read(options.source);
  const selection = selectLegacyOffersForImport({
    offers: file.offers,
    fixtureOfferIds: options.fixtureOfferIds,
    classification: options.classification,
    batchSize: options.batchSize,
    afterOfferId: options.afterOfferId,
    referenceOnly: options.referenceOnly,
  });
  const normalizedOffers = selection.normalizedOffers;
  const selectedOfferIds = selection.selectedOfferIds;
  const closedDateLookup = options.closedDateLookupFile
    ? await new LegacyClosedDateLookupReader().read(
        options.closedDateLookupFile,
        new Set(normalizedOffers.map((offer) => offer.offerId)),
      )
    : undefined;

  const plan = new LegacyOffersPlanGenerator().build({
    tenantSlug: options.tenantSlug,
    tenantId: options.tenantId,
    sourceFilePath: file.sourceFilePath,
    sourceFileHash: file.sourceFileHash,
    offers: selection.selectedOffers,
    mode: options.mode,
    fixtureOfferIds: options.fixtureOfferIds,
    batchSelection: batchSelectionForPlan(selection),
    existingMaps: [],
  });
  const sourceHistoricalFinancials = options.includeHistoricalFinancials
    ? buildSourceHistoricalFinancialPlan({ options, normalizedOffers, plan })
    : undefined;
  const scopedFinancialResolvedOfferIds = sourceHistoricalFinancials
    ? scopedFinancialResolvedOfferIdsFor(plan, sourceHistoricalFinancials)
    : new Set<string>();
  const scopedPlan = sourceHistoricalFinancials
    ? new LegacyOffersPlanGenerator().build({
        tenantSlug: options.tenantSlug,
        tenantId: options.tenantId,
        sourceFilePath: file.sourceFilePath,
        sourceFileHash: file.sourceFileHash,
        offers: selection.selectedOffers,
        mode: options.mode,
        fixtureOfferIds: options.fixtureOfferIds,
        batchSelection: batchSelectionForPlan(selection),
        existingMaps: [],
        scopedFinancialResolvedOfferIds,
      })
    : plan;

  if (options.mode === 'dry-run') {
    if (options.includeHistoricalFinancials && !options.resolveDb) {
      throw new Error('--include-historical-financials requires --resolve-db.');
    }
    if (!options.resolveDb) {
      console.log(
        JSON.stringify(
          {
            ...scopedPlan,
            closedDateLookup: closedDateLookupSummary(closedDateLookup),
          },
          null,
          2,
        ),
      );
      return;
    }
    const prisma = new PrismaClient();
    try {
      const resolved = await new LegacyDbAwareDryRun(prisma).resolve({
        tenantSlug: options.tenantSlug,
        plan: scopedPlan,
        normalizedOffers,
      });
      const dbAwarePlan = new LegacyOffersPlanGenerator().build({
        tenantSlug: options.tenantSlug,
        tenantId: resolved.resolution.tenant.id,
        sourceFilePath: file.sourceFilePath,
        sourceFileHash: file.sourceFileHash,
        offers: selection.selectedOffers,
        mode: options.mode,
        fixtureOfferIds: options.fixtureOfferIds,
        batchSelection: batchSelectionForPlan(selection),
        existingMaps: resolved.existingMaps,
        scopedFinancialResolvedOfferIds,
      });
      const historicalFinancials = options.includeHistoricalFinancials
        ? await buildHistoricalFinancialPlan({
            prisma,
            options,
            normalizedOffers,
            plan: dbAwarePlan,
          })
        : undefined;
      console.log(
        JSON.stringify(
          {
            ...dbAwarePlan,
            closedDateLookup: closedDateLookupSummary(closedDateLookup),
            historicalFinancials,
            scopedEligibility: scopedEligibilitySummary(
              dbAwarePlan,
              historicalFinancials,
            ),
            dbResolution: resolved.resolution,
          },
          null,
          2,
        ),
      );
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  if (!options.allowApply) {
    throw new Error('Apply requires --allow-apply.');
  }
  validateApplySelection(selection);
  if (selection.mode === 'reference-only' && !options.resolveDb) {
    throw new Error('Reference apply requires --resolve-db.');
  }
  if (selection.mode === 'classification-batch' && !options.resolveDb) {
    throw new Error('Batch apply requires --resolve-db.');
  }
  if (options.includeHistoricalFinancials && !options.resolveDb) {
    throw new Error(
      '--include-historical-financials apply requires --resolve-db.',
    );
  }
  if (!options.tenantId || !options.importUserId) {
    throw new Error('Apply requires --tenant-id and --import-user-id.');
  }

  const prisma = new PrismaClient();
  try {
    const applyPlan = options.resolveDb
      ? await buildDbAwarePlan({
          prisma,
          options,
          file,
          plan: scopedPlan,
          normalizedOffers,
          selectedOfferIds,
          batchSelection: batchSelectionForPlan(selection),
          scopedFinancialResolvedOfferIds,
        })
      : scopedPlan;
    const result = await new LegacyOffersImporter(prisma).apply({
      tenantId: options.tenantId,
      tenantSlug: options.tenantSlug,
      importUserId: options.importUserId,
      sourceFilePath: file.sourceFilePath,
      sourceFileHash: file.sourceFileHash,
      plan: applyPlan,
      normalizedOffers,
      closedDateLookup: closedDateLookup?.entries,
      historicalFinancials: options.includeHistoricalFinancials
        ? await buildHistoricalFinancialPlan({
            prisma,
            options,
            normalizedOffers,
            plan: applyPlan,
          })
        : undefined,
      scope: applyScopeForSelection(selection.mode),
    });
    console.log(
      JSON.stringify(
        {
          selectedOfferIds,
          rollbackCommand: `npm run legacy:irisk:offers --workspace=apps/reinsurance-service -- --mode rollback --tenant-id ${options.tenantId} --import-run-id ${result.importRunId} --allow-apply`,
          ...result,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function buildDbAwarePlan(input: {
  prisma: PrismaClient;
  options: CliOptions;
  file: { sourceFilePath: string; sourceFileHash: string };
  plan: ReturnType<LegacyOffersPlanGenerator['build']>;
  normalizedOffers: ReturnType<
    typeof selectLegacyOffersForImport
  >['normalizedOffers'];
  selectedOfferIds: string[];
  batchSelection: ReturnType<typeof batchSelectionForPlan>;
  scopedFinancialResolvedOfferIds: Set<string>;
}) {
  const resolved = await new LegacyDbAwareDryRun(input.prisma).resolve({
    tenantSlug: input.options.tenantSlug,
    plan: input.plan,
    normalizedOffers: input.normalizedOffers,
  });
  return new LegacyOffersPlanGenerator().build({
    tenantSlug: input.options.tenantSlug,
    tenantId: resolved.resolution.tenant.id,
    sourceFilePath: input.file.sourceFilePath,
    sourceFileHash: input.file.sourceFileHash,
    offers: input.normalizedOffers.map((offer) => offer.source),
    mode: input.options.mode,
    fixtureOfferIds: input.options.fixtureOfferIds,
    batchSelection: input.batchSelection,
    existingMaps: resolved.existingMaps,
    scopedFinancialResolvedOfferIds: input.scopedFinancialResolvedOfferIds,
  });
}

function closedDateLookupSummary(
  file: Awaited<ReturnType<LegacyClosedDateLookupReader['read']>> | undefined,
) {
  if (!file) return undefined;
  return {
    sourceFilePath: file.sourceFilePath,
    sourceFileHash: file.sourceFileHash,
    applicableCount: file.entries.size,
    ignoredLookupOnlyCount: file.ignoredLookupOnlyIds.length,
    ignoredLookupOnlyIds: file.ignoredLookupOnlyIds,
  };
}

function batchSelectionForPlan(
  selection: ReturnType<typeof selectLegacyOffersForImport>,
) {
  return {
    mode: selection.mode,
    selectedOfferIds: selection.selectedOfferIds,
    classification: selection.classification,
    batchSize: selection.batchSize,
    afterOfferId: selection.afterOfferId,
  };
}

async function rollback(options: CliOptions) {
  if (!options.allowApply) {
    throw new Error('Rollback requires --allow-apply.');
  }
  if (!options.importRunId || !options.tenantId) {
    throw new Error('Rollback requires --import-run-id and --tenant-id.');
  }
  const prisma = new PrismaClient();
  try {
    const result = await new LegacyOffersRollback(prisma).rollback(
      options.importRunId,
      options.tenantId,
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    tenantSlug: 'acme-ghana',
    mode: 'dry-run',
    fixtureOfferIds: [],
    allowApply: false,
    resolveDb: false,
    referenceOnly: false,
    includeHistoricalFinancials: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--source' || arg === '--source-file')
      options.source = requiredValue(arg, next, () => index++);
    else if (arg === '--closed-date-lookup-file') {
      options.closedDateLookupFile = requiredValue(arg, next, () => index++);
    } else if (arg === '--tenant-slug') {
      options.tenantSlug = requiredValue(arg, next, () => index++);
    } else if (arg === '--tenant-id') {
      options.tenantId = requiredValue(arg, next, () => index++);
    } else if (arg === '--import-user-id') {
      options.importUserId = requiredValue(arg, next, () => index++);
    } else if (arg === '--mode') {
      options.mode = parseMode(requiredValue(arg, next, () => index++));
    } else if (arg === '--fixture') {
      options.fixtureOfferIds = requiredValue(arg, next, () => index++)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    } else if (arg === '--classification') {
      options.classification = parseClassification(
        requiredValue(arg, next, () => index++),
      );
    } else if (arg === '--batch-size') {
      options.batchSize = parseBatchSize(
        requiredValue(arg, next, () => index++),
      );
    } else if (arg === '--after-offer-id') {
      options.afterOfferId = requiredValue(arg, next, () => index++);
    } else if (arg === '--reference-only') {
      options.referenceOnly = true;
    } else if (arg === '--allow-apply') {
      options.allowApply = true;
    } else if (arg === '--resolve-db') {
      options.resolveDb = true;
    } else if (arg === '--import-run-id') {
      options.importRunId = requiredValue(arg, next, () => index++);
    } else if (arg === '--include-historical-financials') {
      options.includeHistoricalFinancials = true;
    } else if (arg === '--financial-source-dir') {
      options.financialSourceDir = requiredValue(arg, next, () => index++);
    } else if (arg === '--offer-crosswalk-file') {
      options.offerCrosswalkFile = requiredValue(arg, next, () => index++);
    } else if (arg === '--participant-crosswalk-file') {
      options.participantCrosswalkFile = requiredValue(
        arg,
        next,
        () => index++,
      );
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function buildHistoricalFinancialPlan(input: {
  prisma: PrismaClient;
  options: CliOptions;
  normalizedOffers: ReturnType<
    typeof selectLegacyOffersForImport
  >['normalizedOffers'];
  plan: ReturnType<LegacyOffersPlanGenerator['build']>;
}) {
  const financialOptions = financialSourceOptions(input.options);
  const offerIds = input.normalizedOffers.map((offer) => offer.offerId);
  const participantIds = input.normalizedOffers.flatMap((offer) =>
    offer.participants.map((participant) => participant.participantId),
  );
  const maps = await input.prisma.legacyImportMap.findMany({
    where: {
      sourceSystem: LEGACY_SOURCE_SYSTEM,
      tenantId: input.plan.tenantId,
      OR: [
        { entityType: 'offer', legacyId: { in: offerIds } },
        { entityType: 'offer_participant', legacyId: { in: participantIds } },
        {
          entityType: 'offer_participant_closing',
          legacyId: { in: participantIds },
        },
        {
          entityType: { in: financialLegacyMapEntityTypes() },
          legacyId: { in: [...offerIds, ...participantIds] },
        },
      ],
    },
    select: {
      entityType: true,
      legacyId: true,
      currentModel: true,
      currentId: true,
      rawHash: true,
    },
  });
  const placementByOfferId = new Map(
    maps
      .filter(
        (map) => map.entityType === 'offer' && map.currentModel === 'Placement',
      )
      .map((map) => [map.legacyId, map.currentId]),
  );
  const participantMaps = new Map(
    maps
      .filter(
        (map) =>
          map.entityType === 'offer_participant' &&
          map.currentModel === 'PlacementParticipant',
      )
      .map((map) => [map.legacyId, map.currentId]),
  );
  const closingMaps = new Map(
    maps
      .filter(
        (map) =>
          map.entityType === 'offer_participant_closing' &&
          map.currentModel === 'PlacementClosing',
      )
      .map((map) => [map.legacyId, map.currentId]),
  );
  const participantByLegacyId = new Map(
    participantIds
      .filter((participantId) => participantMaps.has(participantId))
      .map((participantId) => [
        participantId,
        {
          participantId: participantMaps.get(participantId)!,
          closingId: closingMaps.get(participantId)!,
        },
      ]),
  );
  return new LegacyFinancialPlanner().build({
    options: financialOptions,
    normalizedOffers: input.normalizedOffers,
    placementByOfferId,
    excludedOfferIds: financialWriteExcludedOfferIds(input.plan),
    participantByLegacyId,
    existingMaps: maps.filter((map) =>
      financialLegacyMapEntityTypes().includes(map.entityType),
    ),
  });
}

function buildSourceHistoricalFinancialPlan(input: {
  options: CliOptions;
  normalizedOffers: ReturnType<
    typeof selectLegacyOffersForImport
  >['normalizedOffers'];
  plan: ReturnType<LegacyOffersPlanGenerator['build']>;
}) {
  return new LegacyFinancialPlanner().build({
    options: financialSourceOptions(input.options),
    normalizedOffers: input.normalizedOffers,
    placementByOfferId: new Map(),
    participantByLegacyId: new Map(),
    excludedOfferIds: hardRejectedOfferIds(input.plan),
    existingMaps: [],
  });
}

function hardRejectedOfferIds(
  plan: ReturnType<LegacyOffersPlanGenerator['build']>,
) {
  return new Set(
    plan.records
      .filter(
        (record) =>
          record.scopedEligibility === 'DATA_MISMATCH' ||
          record.action === 'reject' ||
          record.action === 'conflict',
      )
      .map((record) => record.offerId),
  );
}

function financialWriteExcludedOfferIds(
  plan: ReturnType<LegacyOffersPlanGenerator['build']>,
) {
  return new Set(
    plan.records
      .filter(
        (record) =>
          record.scopedEligibility === 'DATA_MISMATCH' ||
          record.action === 'reject' ||
          record.action === 'review' ||
          record.action === 'conflict',
      )
      .map((record) => record.offerId),
  );
}

function scopedFinancialResolvedOfferIdsFor(
  plan: ReturnType<LegacyOffersPlanGenerator['build']>,
  financials: LegacyFinancialPlan,
) {
  const blocked = new Set(
    financials.blockedOffers.map((offer) => offer.legacyOfferId),
  );
  return new Set(
    plan.records
      .filter(
        (record) =>
          record.classification === 'NEEDS_FINANCIAL_REVIEW' &&
          !blocked.has(record.offerId),
      )
      .map((record) => record.offerId),
  );
}

function scopedEligibilitySummary(
  plan: ReturnType<LegacyOffersPlanGenerator['build']>,
  financials?: LegacyFinancialPlan,
) {
  const financialUnresolvedIds = [
    ...new Set([
      ...plan.records
        .filter((record) => record.scopedEligibility === 'FINANCIAL_UNRESOLVED')
        .map((record) => record.offerId),
      ...(financials?.blockedOffers.map((offer) => offer.legacyOfferId) ?? []),
    ]),
  ].sort((left, right) => Number(left) - Number(right));
  const dataMismatchIds = plan.records
    .filter((record) => record.classification === 'DATA_MISMATCH')
    .map((record) => record.offerId)
    .sort((left, right) => Number(left) - Number(right));
  const scopedFinancialResolvedIds = plan.records
    .filter(
      (record) => record.scopedEligibility === 'SCOPED_FINANCIAL_RESOLVED',
    )
    .map((record) => record.offerId)
    .sort((left, right) => Number(left) - Number(right));
  return {
    eligibleTotal: plan.records.filter(
      (record) =>
        record.scopedEligibility === 'AUTO_SAFE' ||
        record.scopedEligibility === 'SCOPED_FINANCIAL_RESOLVED',
    ).length,
    autoSafe: plan.records.filter(
      (record) => record.scopedEligibility === 'AUTO_SAFE',
    ).length,
    scopedFinancialResolved: scopedFinancialResolvedIds.length,
    scopedFinancialResolvedIds,
    financiallyUnresolved: financialUnresolvedIds.length,
    financiallyUnresolvedIds: financialUnresolvedIds,
    dataMismatch: dataMismatchIds.length,
    dataMismatchIds,
  };
}

function financialSourceOptions(
  options: CliOptions,
): LegacyFinancialSourceOptions {
  if (
    !options.financialSourceDir ||
    !options.offerCrosswalkFile ||
    !options.participantCrosswalkFile
  ) {
    throw new Error(
      '--include-historical-financials requires --financial-source-dir, --offer-crosswalk-file, and --participant-crosswalk-file.',
    );
  }
  return {
    sourceDir: options.financialSourceDir,
    offerCrosswalkFile: options.offerCrosswalkFile,
    participantCrosswalkFile: options.participantCrosswalkFile,
  };
}

function applyScopeForSelection(
  mode: ReturnType<typeof selectLegacyOffersForImport>['mode'],
) {
  if (mode === 'reference-only') return 'reference-only';
  if (mode === 'classification-batch') return 'placement-batch';
  return 'fixture';
}

function parseClassification(value: string): LegacyOfferClassification {
  if (
    value === 'AUTO_SAFE' ||
    value === 'NEEDS_FINANCIAL_REVIEW' ||
    value === 'DATA_MISMATCH'
  ) {
    return value;
  }
  throw new Error(`Unsupported classification '${value}'.`);
}

function parseBatchSize(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid --batch-size '${value}'.`);
  }
  return parsed;
}

function parseMode(value: string): LegacyImportMode {
  if (value === 'dry-run' || value === 'apply' || value === 'rollback') {
    return value;
  }
  throw new Error(`Unsupported mode '${value}'.`);
}

function requiredValue(
  arg: string,
  value: string | undefined,
  consume: () => void,
) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${arg} requires a value.`);
  }
  consume();
  return value;
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        sourceSystem: LEGACY_SOURCE_SYSTEM,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
