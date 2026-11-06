import { readFile, mkdir, lstat, open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, relative, sep } from 'node:path';
import { Actor, ArchiveDatabase, parseIdentity } from '../loader/database';
import { datasetReport, validateDataset } from '../loader/dataset';
import {
  applyDataset,
  loadStatus,
  Plan,
  planApply,
  planRollback,
  rollbackDataset,
  WriteApproval,
} from '../loader/lifecycle';
import { canonical, object, sha, text } from '../loader/source-contract';

const valued = new Set([
  'mode',
  'dataset-key',
  'dataset-version',
  'manifest-file',
  'source-root',
  'match-manifest-file',
  'output-file',
  'identity-file',
  'environment',
  'tenant-id',
  'tenant-slug',
  'import-user-id',
  'load-id',
  'reviewed-plan-file',
  'approved-plan-sha256',
  'expected-manifest-sha256',
  'confirm-tenant-id',
  'confirm-dataset',
  'approval-ref',
  'expected-current-load-id',
  'resume-load-id',
  'replace-load-id',
  'confirm-load-id',
  'batch-size',
]);
const flags = new Set([
  'allow-archive-write',
  'stage-only',
  'allow-unentitled-local-test',
]);
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--'))
      throw new Error('Expected named archive option');
    const aliases: Record<string, string> = {
      'match-file': 'match-manifest-file',
      'expected-database-identity-file': 'identity-file',
    };
    const key = aliases[token.slice(2)] ?? token.slice(2);
    if (key in args || (!valued.has(key) && !flags.has(key)))
      throw new Error('Unknown or repeated archive option');
    if (flags.has(key)) args[key] = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith('--'))
        throw new Error('Missing archive option value');
      args[key] = value;
    }
  }
  return args;
}
function required(args: Record<string, string | boolean>, key: string) {
  return text(args[key], key);
}
async function jsonFile(path: string): Promise<unknown> {
  const bytes = await readFile(path);
  if (bytes.length > 16 * 1024 * 1024)
    throw new Error('Manifest/plan size limit');
  return JSON.parse(bytes.toString('utf8')) as unknown;
}
async function reserveOutput(path: string) {
  if (!isAbsolute(path))
    throw new Error('Output must be an absolute private path');
  const parent = dirname(path);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const info = await lstat(parent);
  const resolved = await realpath(parent);
  const repo = resolve(__dirname, '../../../../..');
  const rel = relative(repo, resolved);
  if (
    info.isSymbolicLink() ||
    !info.isDirectory() ||
    (info.mode & 0o077) !== 0 ||
    (!rel.startsWith(`..${sep}`) && rel !== '..') ||
    (process.getuid && info.uid !== process.getuid())
  )
    throw new Error(
      'Output directory must be private, owned, and outside the repository',
    );
  return open(path, 'wx', 0o600);
}
export async function privateOutput(path: string, value: unknown) {
  const handle = await reserveOutput(path);
  try {
    await handle.writeFile(JSON.stringify(value, null, 2) + '\n');
  } finally {
    await handle.close();
  }
}
export async function runArchiveCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const args = parseArgs(argv),
    mode = required(args, 'mode');
  if (!['validate', 'dry-run', 'apply', 'status', 'rollback'].includes(mode))
    throw new Error('Unknown archive mode');
  const output = required(args, 'output-file');
  const writes =
    mode === 'apply' ||
    (mode === 'rollback' && args['allow-archive-write'] === true);
  if (
    !writes &&
    Object.keys(args).some((k) =>
      [
        'allow-archive-write',
        'reviewed-plan-file',
        'approved-plan-sha256',
        'expected-manifest-sha256',
        'confirm-tenant-id',
        'confirm-dataset',
        'approval-ref',
        'expected-current-load-id',
        'resume-load-id',
        'replace-load-id',
        'confirm-load-id',
      ].includes(k),
    )
  )
    throw new Error(
      'Write authorizations are invalid in a source-read command',
    );
  if (mode === 'validate') {
    if (
      [
        'identity-file',
        'environment',
        'tenant-id',
        'tenant-slug',
        'import-user-id',
        'load-id',
        'allow-unentitled-local-test',
      ].some((k) => k in args)
    )
      throw new Error(
        'Offline validation does not accept database/actor options',
      );
    const d = await validateDataset({
      manifestFile: required(args, 'manifest-file'),
      sourceRoot: required(args, 'source-root'),
      matchFile:
        typeof args['match-manifest-file'] === 'string'
          ? args['match-manifest-file']
          : undefined,
    });
    if (
      (args['dataset-key'] !== undefined &&
        args['dataset-key'] !== d.manifest.datasetKey) ||
      (args['dataset-version'] !== undefined &&
        args['dataset-version'] !== d.manifest.datasetVersion)
    )
      throw new Error(
        'Explicit dataset identity does not match source manifest',
      );
    await privateOutput(output, datasetReport(d));
    return {
      mode,
      output,
      observations: d.observations,
      discrepancies: d.discrepancies,
    };
  }
  const identity = parseIdentity(
    await jsonFile(required(args, 'identity-file')),
  );
  if (required(args, 'environment') !== identity.environment)
    throw new Error('Environment confirmation mismatch');
  const actor: Actor = {
    tenantId: required(args, 'tenant-id'),
    tenantSlug: required(args, 'tenant-slug'),
    userId: required(args, 'import-user-id'),
    ...(args['allow-unentitled-local-test']
      ? { allowUnentitledLocalTest: true }
      : {}),
  };
  if (actor.allowUnentitledLocalTest && identity.purpose !== 'DISPOSABLE_TEST')
    throw new Error(
      'Entitlement bypass is only permitted in a disposable local test database',
    );
  const readUrl = text(
    env.ARCHIVE_READ_DATABASE_URL,
    'ARCHIVE_READ_DATABASE_URL',
  );
  const db = new ArchiveDatabase(readUrl, identity, 'read');
  let plan: Plan | undefined;
  const dataset = ['dry-run', 'apply'].includes(mode)
    ? await validateDataset({
        manifestFile: required(args, 'manifest-file'),
        sourceRoot: required(args, 'source-root'),
        matchFile:
          typeof args['match-manifest-file'] === 'string'
            ? args['match-manifest-file']
            : undefined,
        tenantId: actor.tenantId,
      })
    : undefined;
  try {
    await db.connect();
    if (mode === 'status') {
      const status = await loadStatus(db, actor, required(args, 'load-id'));
      await privateOutput(output, { status });
      return { mode, output, status: status.status };
    }
    plan =
      mode === 'rollback'
        ? await planRollback(db, actor, required(args, 'load-id'))
        : await planApply(db, dataset!, actor, args['stage-only'] === true);
  } finally {
    await db.close();
  }
  if (
    (args['dataset-key'] !== undefined &&
      args['dataset-key'] !== plan.datasetKey) ||
    (args['dataset-version'] !== undefined &&
      args['dataset-version'] !== plan.datasetVersion)
  )
    throw new Error(
      'Explicit dataset identity does not match reviewed source/load',
    );
  if (!writes) {
    await privateOutput(output, { plan, planSha256: sha(plan) });
    return {
      mode,
      output,
      action: plan.action,
      counts: plan.counts,
      blockers: plan.blockers,
      planSha256: sha(plan),
    };
  }
  if (args['allow-archive-write'] !== true)
    throw new Error('Explicit --allow-archive-write required');
  const review = object(
    await jsonFile(required(args, 'reviewed-plan-file')),
    'reviewed plan file',
  );
  const reviewed = object(review.plan, 'reviewed plan');
  const reviewedAt = text(reviewed.generatedAt, 'reviewed plan timestamp');
  if (
    canonical({ ...reviewed, generatedAt: plan.generatedAt }) !==
    canonical(plan)
  )
    throw new Error('Reviewed plan differs from fresh read-only plan');
  const reviewedPlan: Plan = { ...plan, generatedAt: reviewedAt };
  const approval: WriteApproval = {
    reviewedPlan,
    approvedPlanSha256: required(args, 'approved-plan-sha256'),
    expectedManifestSha256: required(args, 'expected-manifest-sha256'),
    confirmTenantId: required(args, 'confirm-tenant-id'),
    confirmDataset: required(args, 'confirm-dataset'),
    approvalRef: required(args, 'approval-ref'),
    expectedCurrentLoadId:
      required(args, 'expected-current-load-id') === 'NONE'
        ? null
        : required(args, 'expected-current-load-id'),
    allowArchiveWrite: true,
    ...(typeof args['replace-load-id'] === 'string'
      ? { replaceLoadId: args['replace-load-id'] }
      : {}),
    ...(typeof args['resume-load-id'] === 'string'
      ? { resumeLoadId: args['resume-load-id'] }
      : {}),
    ...(typeof args['confirm-load-id'] === 'string'
      ? { confirmLoadId: args['confirm-load-id'] }
      : {}),
  };
  const writer = new ArchiveDatabase(
    text(env.ARCHIVE_WRITE_DATABASE_URL, 'ARCHIVE_WRITE_DATABASE_URL'),
    identity,
    'write',
  );
  const outputHandle = await reserveOutput(output);
  try {
    await writer.connect();
    const result =
      mode === 'rollback'
        ? await rollbackDataset(writer, plan, approval)
        : await applyDataset(writer, dataset!, plan, approval, {
            batchSize:
              args['batch-size'] === undefined
                ? 250
                : Number(args['batch-size']),
          });
    await outputHandle.writeFile(
      JSON.stringify({ plan, result }, null, 2) + '\n',
    );
    return { mode, output, ...result };
  } catch (error) {
    await outputHandle.writeFile(
      JSON.stringify(
        {
          plan,
          result: { outcome: 'FAILED_OR_INTERRUPTED', reviewRequired: true },
        },
        null,
        2,
      ) + '\n',
    );
    throw error;
  } finally {
    await outputHandle.close();
    await writer.close();
  }
}
if (require.main === module) {
  void runArchiveCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(JSON.stringify(result) + '\n');
    })
    .catch((error: unknown) => {
      // Never print connection URLs, raw cell values, SQL parameters, or database error details.
      void error;
      const safe =
        'Archive command failed; review inputs, plan blockers, and restricted database logs';
      process.stderr.write(JSON.stringify({ error: safe }) + '\n');
      process.exitCode = 1;
    });
}
