import { PrismaClient } from '../../../prisma/generated/client';
import { LegacyDbAwareDryRun } from '../legacy-db-aware-dry-run';
import { LegacyOffersImporter } from '../legacy-offers.importer';
import { LegacyOffersNormalizer } from '../legacy-offers.normalizer';
import { LegacyOffersPlanGenerator } from '../legacy-offers.plan';
import { LegacyOffersReader } from '../legacy-offers.reader';
import { LegacyOffersRollback } from '../legacy-offers.rollback';
import { LEGACY_SOURCE_SYSTEM, LegacyImportMode } from '../legacy-import.types';

type CliOptions = {
  source?: string;
  tenantSlug: string;
  tenantId?: string;
  importUserId?: string;
  mode: LegacyImportMode;
  fixtureOfferIds: string[];
  allowApply: boolean;
  resolveDb: boolean;
  importRunId?: string;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === 'rollback') {
    await rollback(options);
    return;
  }
  if (!options.source) {
    throw new Error('--source is required for dry-run and apply modes.');
  }

  const reader = new LegacyOffersReader();
  const file = await reader.read(options.source);
  const selectedOffers =
    options.fixtureOfferIds.length > 0
      ? file.offers.filter((offer) =>
          options.fixtureOfferIds.includes(String(offer.offer_id)),
        )
      : file.offers;
  const normalizer = new LegacyOffersNormalizer();
  const normalizedOffers = selectedOffers.map((offer) =>
    normalizer.normalize(offer),
  );

  const plan = new LegacyOffersPlanGenerator().build({
    tenantSlug: options.tenantSlug,
    tenantId: options.tenantId,
    sourceFilePath: file.sourceFilePath,
    sourceFileHash: file.sourceFileHash,
    offers: file.offers,
    mode: options.mode,
    fixtureOfferIds: options.fixtureOfferIds,
    existingMaps: [],
  });

  if (options.mode === 'dry-run') {
    if (!options.resolveDb) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }
    const prisma = new PrismaClient();
    try {
      const resolved = await new LegacyDbAwareDryRun(prisma).resolve({
        tenantSlug: options.tenantSlug,
        plan,
        normalizedOffers,
      });
      const dbAwarePlan = new LegacyOffersPlanGenerator().build({
        tenantSlug: options.tenantSlug,
        tenantId: resolved.resolution.tenant.id,
        sourceFilePath: file.sourceFilePath,
        sourceFileHash: file.sourceFileHash,
        offers: file.offers,
        mode: options.mode,
        fixtureOfferIds: options.fixtureOfferIds,
        existingMaps: resolved.existingMaps,
      });
      console.log(
        JSON.stringify(
          {
            ...dbAwarePlan,
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
  if (options.fixtureOfferIds.length === 0) {
    throw new Error('Apply is Phase-1 fixture-limited and requires --fixture.');
  }
  if (!options.tenantId || !options.importUserId) {
    throw new Error('Apply requires --tenant-id and --import-user-id.');
  }

  const prisma = new PrismaClient();
  try {
    const result = await new LegacyOffersImporter(prisma).apply({
      tenantId: options.tenantId,
      tenantSlug: options.tenantSlug,
      importUserId: options.importUserId,
      sourceFilePath: file.sourceFilePath,
      sourceFileHash: file.sourceFileHash,
      plan,
      normalizedOffers,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
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
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--source')
      options.source = requiredValue(arg, next, () => index++);
    else if (arg === '--tenant-slug') {
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
    } else if (arg === '--allow-apply') {
      options.allowApply = true;
    } else if (arg === '--resolve-db') {
      options.resolveDb = true;
    } else if (arg === '--import-run-id') {
      options.importRunId = requiredValue(arg, next, () => index++);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
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
