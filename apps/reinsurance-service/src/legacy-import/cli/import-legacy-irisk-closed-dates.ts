import { PrismaClient } from '../../../prisma/generated/client';
import { LegacyClosedDateEnrichment } from '../legacy-closed-date-enrichment';
import { LegacyClosedDateLookupReader } from '../legacy-closed-date-lookup.reader';
import { LegacyOffersReader } from '../legacy-offers.reader';

type CliMode = 'dry-run' | 'apply';

type CliOptions = {
  mode: CliMode;
  source?: string;
  closedDateLookupFile?: string;
  tenantId?: string;
  allowApply: boolean;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.source) {
    throw new Error('--source-file is required.');
  }
  if (!options.closedDateLookupFile) {
    throw new Error('--closed-date-lookup-file is required.');
  }
  if (!options.tenantId) {
    throw new Error('--tenant-id is required.');
  }
  if (options.mode === 'apply' && !options.allowApply) {
    throw new Error('Apply requires --allow-apply.');
  }

  const offerFile = await new LegacyOffersReader().read(options.source);
  const closedSourceOfferIds = offerFile.offers
    .filter(
      (offer) =>
        String(offer.offer_status ?? '')
          .trim()
          .toUpperCase() === 'CLOSED',
    )
    .map((offer) => String(offer.offer_id ?? '').trim())
    .filter(Boolean);
  const lookupFile = await new LegacyClosedDateLookupReader().read(
    options.closedDateLookupFile,
    new Set(closedSourceOfferIds),
  );

  const prisma = new PrismaClient();
  try {
    const enrichment = new LegacyClosedDateEnrichment(prisma);
    const plan = await enrichment.plan({
      tenantId: options.tenantId,
      sourceOffers: offerFile.offers,
      closedDateLookup: lookupFile.entries,
      ignoredLookupOnlyIds: lookupFile.ignoredLookupOnlyIds,
    });
    if (options.mode === 'dry-run') {
      console.log(
        JSON.stringify(
          {
            sourceFile: {
              path: offerFile.sourceFilePath,
              hash: offerFile.sourceFileHash,
            },
            closedDateLookupFile: {
              path: lookupFile.sourceFilePath,
              hash: lookupFile.sourceFileHash,
              applicableCount: lookupFile.entries.size,
              ignoredLookupOnlyCount: lookupFile.ignoredLookupOnlyIds.length,
            },
            ...plan,
          },
          null,
          2,
        ),
      );
      return;
    }

    const result = await enrichment.apply({
      tenantId: options.tenantId,
      plan,
      closedDateLookup: lookupFile.entries,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: 'dry-run',
    allowApply: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--mode') {
      options.mode = parseMode(requiredValue(arg, next, () => index++));
    } else if (arg === '--source' || arg === '--source-file') {
      options.source = requiredValue(arg, next, () => index++);
    } else if (arg === '--closed-date-lookup-file') {
      options.closedDateLookupFile = requiredValue(arg, next, () => index++);
    } else if (arg === '--tenant-id') {
      options.tenantId = requiredValue(arg, next, () => index++);
    } else if (arg === '--allow-apply') {
      options.allowApply = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function parseMode(value: string): CliMode {
  if (value === 'dry-run' || value === 'apply') return value;
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
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
