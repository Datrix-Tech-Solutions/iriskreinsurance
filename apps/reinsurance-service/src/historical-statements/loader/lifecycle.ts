import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { Prisma } from '../../../prisma/generated/client';
import { Actor, ArchiveDatabase, DatabaseIdentity } from './database';
import {
  CE_FIELDS,
  CONTRACT,
  RE_FIELDS,
  ValidatedDataset,
  WorkbookData,
  bytesSha,
  canonical,
  sha,
} from './source-contract';

const LOADER_VERSION = 'm2a/v1';
const BUILD_SHA256 = sha(
  [
    ...[
      'lifecycle',
      'database',
      'dataset',
      'source-contract',
      'workbook-reader',
    ].map((name) => join(__dirname, name + extname(__filename))),
    join(__dirname, '../cli/historical-statements' + extname(__filename)),
  ].map((path) => bytesSha(readFileSync(path))),
);
const LOAD = 'historical_statement_load',
  FILE = 'historical_statement_file',
  CE = 'historical_insurer_statement',
  RE = 'historical_reinsurer_statement',
  LINK = 'historical_statement_link';
export interface LoadRow {
  id: string;
  tenantId: string;
  datasetKey: string;
  datasetVersion: string;
  contentManifestSha256: string;
  status: string;
  sourceManifest: unknown;
  loaderVersion: string;
  lifecycleEvents: unknown[];
  validationSummary: unknown;
}
export interface Plan {
  planVersion: 'historical-archive-plan/v1';
  loaderVersion: string;
  loaderBuildSha256: string;
  contractVersion: typeof CONTRACT;
  sourceFiles?: {
    kind: string;
    year: number;
    sha256: string;
    headerSha256: string;
    businessRowCount: number;
    physicalRowCount: number;
  }[];
  operation: 'apply' | 'rollback';
  generatedAt: string;
  actor: Actor;
  identity: DatabaseIdentity;
  datasetKey: string;
  datasetVersion: string;
  contentManifestSha256: string;
  currentLoadId: string | null;
  existingLoadId: string | null;
  existingStatus: string | null;
  action:
    | 'CREATE'
    | 'SKIP'
    | 'RESUME'
    | 'CONFLICT'
    | 'ROLLBACK'
    | 'ALREADY_ROLLED_BACK';
  counts: Record<string, number>;
  stageOnly: boolean;
  blockers: string[];
  loadId?: string;
}
export interface WriteApproval {
  reviewedPlan: Plan;
  approvedPlanSha256: string;
  expectedManifestSha256: string;
  confirmTenantId: string;
  confirmDataset: string;
  approvalRef: string;
  expectedCurrentLoadId: string | null;
  allowArchiveWrite: boolean;
  resumeLoadId?: string;
  replaceLoadId?: string;
  confirmLoadId?: string;
}
function event(status: string, actor: Actor) {
  return { status, actorUserId: actor.userId, at: new Date().toISOString() };
}
function counts(d: ValidatedDataset) {
  return {
    files: d.files.length,
    insurerRows: d.files
      .filter((f) => f.input.kind === 'INSURER')
      .reduce((s, f) => s + f.rows.length, 0),
    reinsurerRows: d.files
      .filter((f) => f.input.kind === 'REINSURER')
      .reduce((s, f) => s + f.rows.length, 0),
    links: d.links.reduce((s, g) => s + g.reinsurers.length, 0),
  };
}
function fileId(d: ValidatedDataset, loadId: string, f: WorkbookData): string {
  return sha([loadId, d.contentManifestSha256, f.sha256]).slice(0, 32);
}
function rowId(loadId: string, f: WorkbookData, sourceRow: number): string {
  return sha([loadId, f.sha256, sourceRow]).slice(0, 32);
}
const search = (s: string | null | undefined) =>
  (s ?? '').normalize('NFC').trim().toLowerCase();
export function rowRecords(
  d: ValidatedDataset,
  loadId: string,
  f: WorkbookData,
  actor: Actor,
) {
  const at = new Date().toISOString();
  const matches = new Map(
    d.links.map((g) => [
      `${g.insurer.fileSha256}:${g.insurer.sourceRow}`,
      g.matchId,
    ]),
  );
  return f.rows.map((r) => ({
    ...Object.fromEntries(
      (f.input.kind === 'INSURER' ? CE_FIELDS : RE_FIELDS).map((k) => [
        k,
        r.fields[k] ?? null,
      ]),
    ),
    id: rowId(loadId, f, r.sourceRow),
    tenantId: actor.tenantId,
    loadId,
    fileId: fileId(d, loadId, f),
    year: f.input.year,
    sourceRow: r.sourceRow,
    rowSha256: r.rowSha256,
    rawCells: r.rawCells,
    qualityFlags: r.qualityFlags,
    policySearch: search(r.fields.policyNumber),
    insuredSearch: search(r.fields.insuredName),
    businessSearch: search(r.fields.businessName),
    counterpartySearch: search(r.fields.insurerName ?? r.fields.reinsurerName),
    reinsuredSearch: search(r.fields.reinsuredName),
    searchText: search(Object.values(r.fields).filter(Boolean).join(' ')),
    createdByUserId: actor.userId,
    createdAt: at,
    importedAt: at,
    ...(f.input.kind === 'INSURER'
      ? { matchId: matches.get(`${f.sha256}:${r.sourceRow}`) ?? null }
      : {}),
  }));
}
function fileRecords(d: ValidatedDataset, loadId: string, actor: Actor) {
  const at = new Date().toISOString();
  return d.files.map((f) => ({
    id: fileId(d, loadId, f),
    tenantId: actor.tenantId,
    loadId,
    kind: f.input.kind,
    year: f.input.year,
    originalFileName: f.fileName,
    byteSize: String(f.byteSize),
    sha256: f.sha256,
    sheetName: f.sheetName,
    sheetXmlPath: f.sheetXmlPath,
    headerSha256: f.headerSha256,
    headerCells: f.headerCells,
    workbookMetadata: f.workbookMetadata,
    physicalRowCount: f.physicalRowCount,
    businessRowCount: f.rows.length,
    sourceColumnCount: 29,
    rawStorageProvider: f.input.rawStorageProvider ?? 'LOCAL_SOURCE',
    rawStorageKey: f.input.rawStorageKey ?? f.input.path,
    createdByUserId: actor.userId,
    importedAt: at,
    createdAt: at,
  }));
}
function linkRecords(d: ValidatedDataset, loadId: string, actor: Actor) {
  const fileByHash = new Map(d.files.map((f) => [f.sha256, f]));
  return d.links.flatMap((g) =>
    g.reinsurers.map((r) => ({
      id: sha([loadId, g.matchId, r.fileSha256, r.sourceRow]).slice(0, 32),
      tenantId: actor.tenantId,
      loadId,
      matchId: g.matchId,
      insurerRowId: rowId(
        loadId,
        fileByHash.get(g.insurer.fileSha256)!,
        g.insurer.sourceRow,
      ),
      reinsurerRowId: rowId(loadId, fileByHash.get(r.fileSha256)!, r.sourceRow),
      basis: g.basis,
      approvalRef: g.approvalRef,
      evidence: g.evidence,
      evidenceSha256: sha(g.evidence),
      approvedByUserId: g.approvedByUserId,
      approvedAt: g.approvedAt,
      createdByUserId: actor.userId,
      createdAt: new Date().toISOString(),
    })),
  );
}
async function existing(db: ArchiveDatabase, actor: Actor, key: string) {
  return db.query<LoadRow>(
    'SELECT * FROM reinsurance.historical_statement_load WHERE "tenantId"=$1 AND "datasetKey"=$2 ORDER BY id',
    [actor.tenantId, key],
  );
}
export async function planApply(
  db: ArchiveDatabase,
  d: ValidatedDataset,
  actor: Actor,
  stageOnly = false,
): Promise<Plan> {
  return db.transaction(true, async () => {
    await db.verifyPrivileges(false);
    await db.verifyActor(actor);
    const all = await existing(db, actor, d.manifest.datasetKey);
    const current = all.find((l) => l.status === 'PUBLISHED');
    const version = all.find(
      (l) => l.datasetVersion === d.manifest.datasetVersion,
    );
    const content = all.find(
      (l) => l.contentManifestSha256 === d.contentManifestSha256,
    );
    const found = version ?? content;
    const blockers = [...d.discrepancies];
    let action: Plan['action'] = 'CREATE';
    if (d.manifest.tenantId && d.manifest.tenantId !== actor.tenantId)
      blockers.push('Source manifest belongs to another tenant');
    if (version && version.contentManifestSha256 !== d.contentManifestSha256)
      blockers.push('Dataset version has different immutable content');
    if (content && content.datasetVersion !== d.manifest.datasetVersion)
      blockers.push('Identical source content already has another version');
    if (found) {
      if (['PUBLISHED', 'SUPERSEDED'].includes(found.status)) action = 'SKIP';
      else if (['STAGING', 'FAILED', 'READY'].includes(found.status))
        action = 'RESUME';
      else
        blockers.push(
          'Rolled-back content requires a separate explicit restore decision',
        );
    }
    if (blockers.length) action = 'CONFLICT';
    return {
      planVersion: 'historical-archive-plan/v1',
      loaderVersion: LOADER_VERSION,
      loaderBuildSha256: BUILD_SHA256,
      contractVersion: CONTRACT,
      operation: 'apply',
      sourceFiles: d.files.map((f) => ({
        kind: f.input.kind,
        year: f.input.year,
        sha256: f.sha256,
        headerSha256: f.headerSha256,
        businessRowCount: f.rows.length,
        physicalRowCount: f.physicalRowCount,
      })),
      generatedAt: new Date().toISOString(),
      actor,
      identity: db.identity,
      datasetKey: d.manifest.datasetKey,
      datasetVersion: d.manifest.datasetVersion,
      contentManifestSha256: d.contentManifestSha256,
      currentLoadId: current?.id ?? null,
      existingLoadId: found?.id ?? null,
      existingStatus: found?.status ?? null,
      action,
      counts: counts(d),
      stageOnly,
      blockers,
    };
  });
}
function approve(
  plan: Plan,
  a: WriteApproval,
  actor: Actor,
  identity: DatabaseIdentity,
) {
  if (
    plan.loaderVersion !== LOADER_VERSION ||
    plan.loaderBuildSha256 !== BUILD_SHA256 ||
    plan.contractVersion !== CONTRACT ||
    !a.allowArchiveWrite ||
    a.approvedPlanSha256 !== sha(a.reviewedPlan) ||
    sha(planComparable(plan)) !== sha(planComparable(a.reviewedPlan)) ||
    a.confirmTenantId !== actor.tenantId ||
    a.confirmDataset !== `${plan.datasetKey}@${plan.datasetVersion}` ||
    a.expectedManifestSha256 !== plan.contentManifestSha256 ||
    !a.approvalRef.trim() ||
    a.expectedCurrentLoadId !== plan.currentLoadId ||
    canonical(plan.actor) !== canonical(actor) ||
    canonical(plan.identity) !== canonical(identity)
  )
    throw new Error('Write authorization/reviewed plan mismatch');
  const age = Date.now() - Date.parse(a.reviewedPlan.generatedAt);
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000)
    throw new Error('Reviewed plan expired');
  if (plan.blockers.length || plan.action === 'CONFLICT')
    throw new Error('Archive plan is blocked');
}
function planComparable(p: Plan) {
  const { generatedAt, ...rest } = p;
  void generatedAt;
  return rest;
}
async function transition(
  db: ArchiveDatabase,
  load: LoadRow,
  status: string,
  actor: Actor,
  patch: Record<string, unknown> = {},
) {
  const events = [...load.lifecycleEvents, event(status, actor)];
  const fields = {
    status,
    lifecycleEvents: JSON.stringify(events),
    updatedAt: new Date().toISOString(),
    ...patch,
  };
  const names = Object.keys(fields);
  await db.query(
    `UPDATE reinsurance.historical_statement_load SET ${names.map((k, i) => `"${k}"=$${i + 3}`).join(',')} WHERE "tenantId"=$1 AND id=$2`,
    [actor.tenantId, load.id, ...Object.values(fields)],
  );
  load.status = status;
  load.lifecycleEvents = events;
}
async function verifyBytes(d: ValidatedDataset) {
  for (const f of d.files)
    if (bytesSha(await readFile(f.input.path)) !== f.sha256)
      throw new Error('Original workbook checksum changed before publication');
}
async function verifyRows(
  db: ArchiveDatabase,
  d: ValidatedDataset,
  loadId: string,
  actor: Actor,
  complete: boolean,
) {
  for (const f of d.files) {
    const actual = await db.query<Record<string, unknown>>(
      `SELECT id,year,"policySearch","insuredSearch","businessSearch","counterpartySearch","reinsuredSearch","searchText","rowSha256","sourceRow","rawCells","qualityFlags",${(f.input.kind === 'INSURER' ? CE_FIELDS : RE_FIELDS).map((k) => `"${k}"::text AS "${k}"`).join(',')}${f.input.kind === 'INSURER' ? ',"matchId"' : ''} FROM reinsurance."${f.input.kind === 'INSURER' ? CE : RE}" WHERE "tenantId"=$1 AND "loadId"=$2 AND "fileId"=$3 ORDER BY "sourceRow"`,
      [actor.tenantId, loadId, fileId(d, loadId, f)],
    );
    const expected = new Map(f.rows.map((r) => [r.sourceRow, r]));
    if (complete && actual.length !== f.rows.length)
      throw new Error('Incomplete physical source row coverage');
    for (const a of actual) {
      const e = expected.get(Number(a.sourceRow));
      if (
        !e ||
        a.id !== rowId(loadId, f, e.sourceRow) ||
        a.year !== f.input.year ||
        a.rowSha256 !== e.rowSha256 ||
        sha(a.rawCells) !== e.rowSha256 ||
        canonical(a.qualityFlags) !== canonical(e.qualityFlags)
      )
        throw new Error('Staged source identity/hash mismatch');
      const expectedSearch = rowRecords(
        d,
        loadId,
        { ...f, rows: [e] },
        actor,
      )[0];
      for (const key of [
        'policySearch',
        'insuredSearch',
        'businessSearch',
        'counterpartySearch',
        'reinsuredSearch',
        'searchText',
      ])
        if (a[key] !== expectedSearch[key as keyof typeof expectedSearch])
          throw new Error('Staged search metadata mismatch');
      for (const [k, v] of Object.entries(e.fields)) {
        const value = a[k];
        if (
          v === null
            ? value !== null
            : typeof value !== 'string' ||
              (DATE_FIELDS_LOCAL.has(k) || !NUMERIC_FIELDS.has(k)
                ? value !== v
                : !new Prisma.Decimal(value).eq(v))
        )
          throw new Error('Staged typed field mismatch');
      }
      if (f.input.kind === 'INSURER') {
        const match =
          d.links.find(
            (g) =>
              g.insurer.fileSha256 === f.sha256 &&
              g.insurer.sourceRow === e.sourceRow,
          )?.matchId ?? null;
        if (a.matchId !== match) throw new Error('Staged Match ID mismatch');
      }
    }
  }
}
async function verifyContents(
  db: ArchiveDatabase,
  d: ValidatedDataset,
  loadId: string,
  actor: Actor,
  complete: boolean,
) {
  const stored = await db.query<Record<string, unknown>>(
    'SELECT * FROM reinsurance.historical_statement_file WHERE "tenantId"=$1 AND "loadId"=$2',
    [actor.tenantId, loadId],
  );
  const expected = fileRecords(d, loadId, actor);
  if (complete && stored.length !== expected.length)
    throw new Error('Incomplete workbook coverage');
  for (const f of stored) {
    const e = expected.find((x) => x.id === f.id);
    if (!e) throw new Error('Unexpected source workbook');
    for (const k of [
      'tenantId',
      'loadId',
      'kind',
      'year',
      'sha256',
      'sheetName',
      'sheetXmlPath',
      'headerSha256',
      'sourceColumnCount',
      'physicalRowCount',
      'businessRowCount',
    ])
      if (f[k] !== e[k as keyof typeof e])
        throw new Error('Workbook identity mismatch');
    if (
      String(f.byteSize) !== e.byteSize ||
      sha(f.headerCells) !== sha(e.headerCells) ||
      sha(f.workbookMetadata) !== sha(e.workbookMetadata)
    )
      throw new Error('Workbook content metadata mismatch');
  }
  await verifyRows(db, d, loadId, actor, complete);
  const links = await db.query<Record<string, unknown>>(
    'SELECT *,replace("approvedAt"::text,chr(32),chr(84)) || chr(90) AS "approvalText" FROM reinsurance.historical_statement_link WHERE "tenantId"=$1 AND "loadId"=$2',
    [actor.tenantId, loadId],
  );
  const expectedLinks = linkRecords(d, loadId, actor);
  if (complete && links.length !== expectedLinks.length)
    throw new Error('Incomplete approved link coverage');
  for (const l of links) {
    const e = expectedLinks.find((x) => x.id === l.id);
    if (!e) throw new Error('Unexpected approved link');
    for (const k of [
      'tenantId',
      'loadId',
      'matchId',
      'insurerRowId',
      'reinsurerRowId',
      'basis',
      'approvalRef',
      'evidenceSha256',
      'approvedByUserId',
    ])
      if (l[k] !== e[k as keyof typeof e])
        throw new Error('Approved link identity mismatch');
    if (
      sha(l.evidence) !== sha(e.evidence) ||
      new Date(String(l.approvalText)).toISOString() !==
        new Date(e.approvedAt).toISOString()
    )
      throw new Error('Approved link evidence mismatch');
  }
}
const DATE_FIELDS_LOCAL = new Set([
  'offerDate',
  'closedDate',
  'startDate',
  'endDate',
]);
const NUMERIC_FIELDS = new Set([
  ...CE_FIELDS.slice(9, 27),
  ...RE_FIELDS.slice(10, 27),
]);
export async function applyDataset(
  db: ArchiveDatabase,
  d: ValidatedDataset,
  plan: Plan,
  a: WriteApproval,
  options: { batchSize?: number; interruptAfterBatches?: number } = {},
) {
  const batchSize = options.batchSize ?? 250;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500)
    throw new Error('Invalid bounded batch size');
  approve(plan, a, plan.actor, db.identity);
  if (
    plan.operation !== 'apply' ||
    plan.datasetKey !== d.manifest.datasetKey ||
    plan.datasetVersion !== d.manifest.datasetVersion
  )
    throw new Error('Apply source/plan identity mismatch');
  if (
    d.contentManifestSha256 !== plan.contentManifestSha256 ||
    d.discrepancies.length
  )
    throw new Error('Source plan is unresolved');
  await db.verifyPrivileges(true);
  await db.verifyActor(plan.actor);
  const actor = plan.actor;
  return db.locked(actor.tenantId, plan.datasetKey, async () => {
    const all = await existing(db, actor, plan.datasetKey);
    const current = all.find((l) => l.status === 'PUBLISHED');
    if ((current?.id ?? null) !== a.expectedCurrentLoadId)
      throw new Error('Published dataset changed after review');
    let load = all.find((l) => l.datasetVersion === plan.datasetVersion);
    if (load && load.contentManifestSha256 !== d.contentManifestSha256)
      throw new Error('Immutable dataset version conflict');
    if (
      !load &&
      all.some((l) => l.contentManifestSha256 === d.contentManifestSha256)
    )
      throw new Error('Content already belongs to another version');
    if (
      (load?.id ?? null) !== plan.existingLoadId ||
      (load?.status ?? null) !== plan.existingStatus
    )
      throw new Error('Dataset state changed since review');
    if (load && ['PUBLISHED', 'SUPERSEDED'].includes(load.status)) {
      await verifyContents(db, d, load.id, actor, true);
      await verifyBytes(d);
      return { loadId: load.id, outcome: 'IDEMPOTENT_SKIP' };
    }
    if (current && plan.action !== 'SKIP' && a.replaceLoadId !== current.id)
      throw new Error('Explicit replacement load confirmation required');
    if (load && load.loaderVersion !== `${LOADER_VERSION}:${BUILD_SHA256}`)
      throw new Error('Resume requires the identical reviewed loader build');
    if (
      load &&
      (!a.resumeLoadId ||
        a.resumeLoadId !== load.id ||
        !['STAGING', 'FAILED', 'READY'].includes(load.status))
    )
      throw new Error('Explicit matching resume-load-id required');
    const manifest = {
      files: fileRecords(d, 'pending', actor).map(
        ({
          id,
          tenantId,
          loadId,
          createdByUserId,
          importedAt,
          createdAt,
          ...descriptor
        }) => {
          void id;
          void tenantId;
          void loadId;
          void createdByUserId;
          void importedAt;
          void createdAt;
          return descriptor;
        },
      ),
      allUnlinked: d.manifest.allUnlinked,
      observations: d.observations,
    };
    if (!load) {
      const at = new Date().toISOString();
      const id = randomUUID();
      const record = {
        id,
        tenantId: actor.tenantId,
        datasetKey: plan.datasetKey,
        datasetVersion: plan.datasetVersion,
        contentManifestSha256: d.contentManifestSha256,
        matchManifestSha256: d.matchManifestSha256,
        contractVersion: CONTRACT,
        parserVersion: CONTRACT,
        loaderVersion: `${LOADER_VERSION}:${BUILD_SHA256}`,
        status: 'STAGING',
        sourceManifest: manifest,
        validationSummary: {},
        progress: {},
        lifecycleEvents: [event('STAGING', actor)],
        createdByUserId: actor.userId,
        startedAt: at,
        createdAt: at,
        updatedAt: at,
      };
      await db.transaction(false, () => db.insert(LOAD, [record]));
      load = (await existing(db, actor, plan.datasetKey)).find(
        (l) => l.id === id,
      )!;
    }
    const owner = load;
    let batches = 0;
    try {
      await verifyBytes(d);
      if (owner.status === 'FAILED')
        await db.transaction(false, () =>
          transition(db, owner, 'STAGING', actor),
        );
      const storedFiles = await db.query<Record<string, unknown>>(
        'SELECT * FROM reinsurance.historical_statement_file WHERE "tenantId"=$1 AND "loadId"=$2',
        [actor.tenantId, owner.id],
      );
      const expectedFiles = fileRecords(d, owner.id, actor);
      for (const file of storedFiles) {
        const e = expectedFiles.find((f) => f.id === file.id);
        if (
          !e ||
          file.sha256 !== e.sha256 ||
          file.headerSha256 !== e.headerSha256 ||
          sha(file.headerCells) !== sha(e.headerCells) ||
          canonical(file.workbookMetadata) !== canonical(e.workbookMetadata) ||
          Number(file.businessRowCount) !== e.businessRowCount
        )
          throw new Error('Staged file metadata mismatch');
      }
      await verifyContents(db, d, owner.id, actor, false);
      if (owner.status === 'STAGING') {
        for (const f of expectedFiles)
          if (!storedFiles.some((s) => s.id === f.id))
            await db.transaction(false, () => db.insert(FILE, [f]));
        for (const f of d.files) {
          const table = f.input.kind === 'INSURER' ? CE : RE;
          const present = await db.query<{ sourceRow: number }>(
            `SELECT "sourceRow" FROM reinsurance."${table}" WHERE "tenantId"=$1 AND "loadId"=$2 AND "fileId"=$3`,
            [actor.tenantId, owner.id, fileId(d, owner.id, f)],
          );
          const have = new Set(present.map((x) => x.sourceRow));
          const rows = rowRecords(d, owner.id, f, actor).filter(
            (r) => !have.has(r.sourceRow),
          );
          for (let i = 0; i < rows.length; i += batchSize) {
            await db.transaction(false, async () => {
              await db.insert(table, rows.slice(i, i + batchSize));
              await db.query(
                'UPDATE reinsurance.historical_statement_load SET progress=$3::jsonb,"updatedAt"=now() WHERE "tenantId"=$1 AND id=$2',
                [
                  actor.tenantId,
                  owner.id,
                  JSON.stringify({ batches: ++batches }),
                ],
              );
            });
            if (options.interruptAfterBatches === batches)
              throw new Error('Simulated staging interruption');
          }
        }
        const links = linkRecords(d, owner.id, actor),
          storedLinks = await db.query<{ id: string }>(
            'SELECT id FROM reinsurance.historical_statement_link WHERE "tenantId"=$1 AND "loadId"=$2',
            [actor.tenantId, owner.id],
          );
        if (storedLinks.some((l) => !links.some((e) => e.id === l.id)))
          throw new Error('Unexpected staged matching links');
        const missing = links.filter(
          (l) => !storedLinks.some((s) => s.id === l.id),
        );
        for (let i = 0; i < missing.length; i += batchSize)
          await db.transaction(false, () =>
            db.insert(LINK, missing.slice(i, i + batchSize)),
          );
      }
      await verifyContents(db, d, owner.id, actor, true);
      await verifyBytes(d);
      const c = counts(d);
      const summary = {
        validated: true,
        fileCount: c.files,
        insurerRowCount: c.insurerRows,
        reinsurerRowCount: c.reinsurerRows,
        linkCount: c.links,
      };
      if (owner.status === 'STAGING')
        await db.transaction(false, () =>
          transition(db, owner, 'READY', actor, {
            readyAt: new Date().toISOString(),
            validationSummary: JSON.stringify(summary),
          }),
        );
      if (plan.stageOnly)
        return { loadId: owner.id, outcome: 'READY_UNPUBLISHED', counts: c };
      await db.transaction(false, async () => {
        await db.verifyActor(actor);
        await verifyContents(db, d, owner.id, actor, true);
        if (current)
          await transition(db, current, 'SUPERSEDED', actor, {
            supersededAt: new Date().toISOString(),
            supersededByLoadId: owner.id,
          });
        await transition(db, owner, 'PUBLISHED', actor, {
          publishedAt: new Date().toISOString(),
          publishedByUserId: actor.userId,
          publicationApprovalRef: a.approvalRef,
        });
      });
      return { loadId: owner.id, outcome: 'PUBLISHED', counts: c };
    } catch (error) {
      try {
        const [actual] = await db.query<LoadRow>(
          'SELECT * FROM reinsurance.historical_statement_load WHERE "tenantId"=$1 AND id=$2',
          [actor.tenantId, owner.id],
        );
        if (actual && ['STAGING', 'READY'].includes(actual.status))
          await db.transaction(false, () =>
            transition(db, actual, 'FAILED', actor, {
              failedAt: new Date().toISOString(),
              errorSummary: JSON.stringify({
                code: 'STAGING_OR_PUBLICATION_FAILED',
              }),
            }),
          );
      } catch {
        /* A disconnected session leaves a resumable, unpublished load. */
      }
      throw error;
    }
  });
}
export async function loadStatus(
  db: ArchiveDatabase,
  actor: Actor,
  loadId: string,
) {
  return db.transaction(true, async () => {
    await db.verifyPrivileges(false);
    await db.verifyActor(actor);
    const rows = await db.query<LoadRow>(
      'SELECT * FROM reinsurance.historical_statement_load WHERE "tenantId"=$1 AND id=$2',
      [actor.tenantId, loadId],
    );
    if (rows.length !== 1) throw new Error('Archive load not found for tenant');
    return rows[0];
  });
}
export async function planRollback(
  db: ArchiveDatabase,
  actor: Actor,
  loadId: string,
): Promise<Plan> {
  return db.transaction(true, async () => {
    await db.verifyPrivileges(false);
    await db.verifyActor(actor);
    const [l] = await db.query<LoadRow>(
      'SELECT * FROM reinsurance.historical_statement_load WHERE "tenantId"=$1 AND id=$2',
      [actor.tenantId, loadId],
    );
    if (!l) throw new Error('Archive load not found for tenant');
    const c: Record<string, number> = {};
    for (const t of [FILE, CE, RE, LINK])
      c[t] = Number(
        (
          await db.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM reinsurance."${t}" WHERE "tenantId"=$1 AND "loadId"=$2`,
            [actor.tenantId, l.id],
          )
        )[0].count,
      );
    const current = (await existing(db, actor, l.datasetKey)).find(
      (x) => x.status === 'PUBLISHED',
    );
    return {
      planVersion: 'historical-archive-plan/v1',
      loaderVersion: LOADER_VERSION,
      loaderBuildSha256: BUILD_SHA256,
      contractVersion: CONTRACT,
      operation: 'rollback',
      generatedAt: new Date().toISOString(),
      actor,
      identity: db.identity,
      datasetKey: l.datasetKey,
      datasetVersion: l.datasetVersion,
      contentManifestSha256: l.contentManifestSha256,
      currentLoadId: current?.id ?? null,
      existingLoadId: l.id,
      existingStatus: l.status,
      loadId: l.id,
      action: l.status === 'ROLLED_BACK' ? 'ALREADY_ROLLED_BACK' : 'ROLLBACK',
      counts: c,
      stageOnly: false,
      blockers: [],
    };
  });
}
export async function rollbackDataset(
  db: ArchiveDatabase,
  plan: Plan,
  a: WriteApproval,
) {
  approve(plan, a, plan.actor, db.identity);
  if (plan.operation !== 'rollback' || a.confirmLoadId !== plan.loadId)
    throw new Error('Exact rollback load confirmation required');
  await db.verifyPrivileges(true);
  await db.verifyActor(plan.actor);
  return db.locked(plan.actor.tenantId, plan.datasetKey, () =>
    db.transaction(false, async () => {
      const all = await existing(db, plan.actor, plan.datasetKey);
      const current = all.find((l) => l.status === 'PUBLISHED');
      if ((current?.id ?? null) !== plan.currentLoadId)
        throw new Error('Publication changed since rollback review');
      const l = all.find((x) => x.id === plan.loadId);
      if (
        !l ||
        l.contentManifestSha256 !== plan.contentManifestSha256 ||
        l.status !== plan.existingStatus
      )
        throw new Error('Rollback identity changed');
      if (l.status === 'ROLLED_BACK')
        return { loadId: l.id, outcome: 'ALREADY_ROLLED_BACK' };
      for (const [t, expected] of Object.entries(plan.counts)) {
        if (![FILE, CE, RE, LINK].includes(t))
          throw new Error('Non-archive rollback target');
        const [{ count }] = await db.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM reinsurance."${t}" WHERE "tenantId"=$1 AND "loadId"=$2`,
          [plan.actor.tenantId, l.id],
        );
        if (Number(count) !== expected)
          throw new Error('Rollback counts changed since review');
      }
      await transition(db, l, 'ROLLED_BACK', plan.actor, {
        rolledBackAt: new Date().toISOString(),
        rolledBackByUserId: plan.actor.userId,
        rollbackReason: a.approvalRef,
      });
      for (const table of [LINK, CE, RE, FILE])
        await db.query(
          `DELETE FROM reinsurance."${table}" WHERE "tenantId"=$1 AND "loadId"=$2`,
          [plan.actor.tenantId, l.id],
        );
      return { loadId: l.id, outcome: 'ROLLED_BACK' };
    }),
  );
}
