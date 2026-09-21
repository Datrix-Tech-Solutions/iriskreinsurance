import { PrismaClient } from '../../../prisma/generated/client';
import { LegacyReinsurerDisbursementRepairPlanner } from '../legacy-reinsurer-disbursement-repair';

type CliOptions = {
  mode: 'dry-run' | 'apply';
  tenantId?: string;
  tenantSlug?: string;
  outputFile: string;
  auditFile: string;
  allowApply: boolean;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.tenantId) throw new Error('--tenant-id is required.');
  if (!options.tenantSlug) throw new Error('--tenant-slug is required.');
  if (options.mode === 'apply' && !options.allowApply) {
    throw new Error('Repair apply requires --allow-apply.');
  }

  const prisma = new PrismaClient();
  try {
    const planner = new LegacyReinsurerDisbursementRepairPlanner(prisma);
    if (options.mode === 'apply') {
      const result = await planner.apply({
        tenantId: options.tenantId,
        tenantSlug: options.tenantSlug,
        auditFile: options.auditFile,
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const plan = await planner.buildPlan({
      tenantId: options.tenantId,
      tenantSlug: options.tenantSlug,
    });
    await planner.writePlan(plan, options.outputFile);
    console.log(
      JSON.stringify(
        {
          outputFile: options.outputFile,
          counts: plan.counts,
          totalsByCurrency: plan.totalsByCurrency,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: 'dry-run',
    outputFile: '/tmp/legacy-reinsurer-disbursement-repair-plan.json',
    auditFile: '/tmp/legacy-reinsurer-disbursement-repair-audit.json',
    allowApply: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--mode') {
      options.mode = parseMode(requiredValue(arg, next, () => index++));
    } else if (arg === '--tenant-id') {
      options.tenantId = requiredValue(arg, next, () => index++);
    } else if (arg === '--tenant-slug') {
      options.tenantSlug = requiredValue(arg, next, () => index++);
    } else if (arg === '--output-file') {
      options.outputFile = requiredValue(arg, next, () => index++);
    } else if (arg === '--audit-file') {
      options.auditFile = requiredValue(arg, next, () => index++);
    } else if (arg === '--allow-apply') {
      options.allowApply = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function parseMode(value: string): CliOptions['mode'] {
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
