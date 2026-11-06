import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Prisma } from '../../../prisma/generated/client';
import {
  ApprovedLink,
  CE_FIELDS,
  RE_FIELDS,
  CONTRACT,
  EXPECTED_ROWS,
  RowRef,
  SHEET,
  SourceFileInput,
  SourceManifest,
  ValidatedDataset,
  WorkbookData,
  bytesSha,
  canonical,
  hashText,
  object,
  sha,
  text,
} from './source-contract';
import { readWorkbook } from './workbook-reader';

export function parseManifest(value: unknown): SourceManifest {
  const m = object(value, 'source manifest');
  if (
    m.contractVersion !== CONTRACT ||
    typeof m.allUnlinked !== 'boolean' ||
    !Array.isArray(m.files) ||
    m.files.length !== 10
  )
    throw new Error('Unsupported source manifest contract');
  const datasetKey = text(m.datasetKey, 'datasetKey'),
    datasetVersion = text(m.datasetVersion, 'datasetVersion');
  if (datasetKey.length > 128 || datasetVersion.length > 128)
    throw new Error('Dataset identity too long');
  const seen = new Set<string>(),
    hashes = new Set<string>();
  const files: SourceFileInput[] = m.files.map((v: unknown) => {
    const f = object(v, 'source file');
    if (
      (f.kind !== 'INSURER' && f.kind !== 'REINSURER') ||
      typeof f.year !== 'number' ||
      !Number.isInteger(f.year) ||
      !EXPECTED_ROWS[f.year]
    )
      throw new Error('Invalid report year/kind');
    const key = `${f.kind}:${f.year}`,
      hash = hashText(f.sha256, 'file hash');
    if (seen.has(key) || hashes.has(hash))
      throw new Error('Duplicate source file identity');
    seen.add(key);
    hashes.add(hash);
    return {
      path: text(f.path, 'source path'),
      kind: f.kind,
      year: f.year,
      sha256: hash,
      ...(f.rawStorageProvider === undefined
        ? {}
        : {
            rawStorageProvider: text(f.rawStorageProvider, 'storage provider'),
          }),
      ...(f.rawStorageKey === undefined
        ? {}
        : { rawStorageKey: text(f.rawStorageKey, 'storage key') }),
    };
  });
  return {
    contractVersion: CONTRACT,
    datasetKey,
    datasetVersion,
    allUnlinked: m.allUnlinked,
    files,
    ...(m.tenantId === undefined
      ? {}
      : { tenantId: text(m.tenantId, 'tenantId') }),
    ...(m.matchManifestSha256 === undefined
      ? {}
      : {
          matchManifestSha256: hashText(
            m.matchManifestSha256,
            'match manifest hash',
          ),
        }),
  };
}
function parseRef(v: unknown): RowRef {
  const r = object(v, 'physical row reference');
  if (
    r.sheet !== SHEET ||
    typeof r.sourceRow !== 'number' ||
    !Number.isSafeInteger(r.sourceRow) ||
    r.sourceRow < 2
  )
    throw new Error('Invalid physical row reference');
  return {
    fileSha256: hashText(r.fileSha256, 'source file hash'),
    sheet: SHEET,
    sourceRow: r.sourceRow,
    rowSha256: hashText(r.rowSha256, 'row hash'),
  };
}
export function validateMatches(
  value: unknown,
  manifest: SourceManifest,
  files: WorkbookData[],
  tenantId: string,
): ApprovedLink[] {
  const m = object(value, 'match manifest');
  if (
    m.contractVersion !== 'historical-statement-links/v1' ||
    m.tenantId !== tenantId ||
    m.datasetKey !== manifest.datasetKey ||
    m.datasetVersion !== manifest.datasetVersion ||
    !Array.isArray(m.groups)
  )
    throw new Error('Match manifest tenant/dataset mismatch');
  if (
    m.unapprovedCandidates !== undefined &&
    (!Array.isArray(m.unapprovedCandidates) ||
      m.unapprovedCandidates.length > 0)
  )
    throw new Error(
      'Unapproved/ambiguous candidates cannot become approved links',
    );
  const lookup = new Map(files.map((f) => [f.sha256, f]));
  const groups = new Set<string>(),
    insurers = new Set<string>(),
    reinsurers = new Set<string>();
  function verify(r: RowRef, kind: 'INSURER' | 'REINSURER'): string {
    const f = lookup.get(r.fileSha256);
    if (
      !f ||
      f.input.kind !== kind ||
      f.sheetName !== r.sheet ||
      f.rows.find((x) => x.sourceRow === r.sourceRow)?.rowSha256 !== r.rowSha256
    )
      throw new Error('Unresolved physical source-row identity');
    return `${r.fileSha256}:${r.sourceRow}`;
  }
  return m.groups.map((v: unknown) => {
    const g = object(v, 'match group');
    const matchId = text(g.matchId, 'Match ID');
    if (
      matchId.length > 128 ||
      Array.from(matchId).some(
        (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
      ) ||
      groups.has(matchId)
    )
      throw new Error('Duplicate/invalid Match ID');
    groups.add(matchId);
    const insurer = parseRef(g.insurer);
    const ce = verify(insurer, 'INSURER');
    if (insurers.has(ce)) throw new Error('Duplicate insurer group');
    insurers.add(ce);
    if (!Array.isArray(g.reinsurers) || g.reinsurers.length === 0)
      throw new Error('Approved group requires reinsurer source rows');
    const re = g.reinsurers.map((x: unknown) => {
      const r = parseRef(x),
        key = verify(r, 'REINSURER');
      if (reinsurers.has(key))
        throw new Error(
          'Reinsurer occurrence has duplicate/conflicting owners',
        );
      reinsurers.add(key);
      return r;
    });
    if (
      g.basis !== 'SUPPLIED_AUTHORITATIVE' &&
      g.basis !== 'APPROVED_CANDIDATE'
    )
      throw new Error('Unapproved matching basis');
    const approvedAt = text(g.approvedAt, 'approval date');
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(approvedAt) ||
      !Number.isFinite(Date.parse(approvedAt)) ||
      new Date(approvedAt).toISOString() !==
        (approvedAt.includes('.')
          ? approvedAt
          : approvedAt.replace('Z', '.000Z'))
    )
      throw new Error('Invalid explicit approval timestamp');
    const evidence = object(g.evidence, 'match evidence');
    if (Object.keys(evidence).length === 0)
      throw new Error('Missing matching evidence');
    return {
      matchId,
      insurer,
      reinsurers: re,
      basis: g.basis,
      approvalRef: text(g.approvalRef, 'approvalRef'),
      approvedByUserId: text(g.approvedByUserId, 'approvedByUserId'),
      approvedAt,
      evidence,
    };
  });
}
export function profile(files: WorkbookData[]): Record<string, number> {
  const o: Record<string, number> = {
    insurerRows: 0,
    reinsurerRows: 0,
    totalRows: 0,
    identicalGroups: 0,
    identicalRows: 0,
    negativeNumericCells: 0,
    epochDateCells: 0,
    extremeYearCells: 0,
    reversedCoverageRows: 0,
  };
  for (const f of files) {
    o[f.input.kind === 'INSURER' ? 'insurerRows' : 'reinsurerRows'] +=
      f.rows.length;
    o.totalRows += f.rows.length;
    const signatures = new Map<string, number>();
    for (const r of f.rows) {
      const signature = sha(r.rawCells.map((c) => c.resolvedText));
      signatures.set(signature, (signatures.get(signature) ?? 0) + 1);
      for (const flag of r.qualityFlags) {
        if (flag.code === 'EPOCH_SENTINEL') o.epochDateCells++;
        if (flag.code === 'EXTREME_SOURCE_YEAR') o.extremeYearCells++;
        if (flag.code === 'REVERSED_COVERAGE') o.reversedCoverageRows++;
      }
      const numericStart = f.input.kind === 'INSURER' ? 9 : 10;
      for (let i = numericStart; i <= 26; i++) {
        const s =
          r.fields[(f.input.kind === 'INSURER' ? CE_FIELDS : RE_FIELDS)[i]];
        if (s && new Prisma.Decimal(s).lt(0)) o.negativeNumericCells++;
      }
    }
    for (const count of signatures.values())
      if (count > 1) {
        o.identicalGroups++;
        o.identicalRows += count;
      }
  }
  return o;
}
export async function validateDataset(options: {
  manifestFile: string;
  sourceRoot: string;
  matchFile?: string;
  tenantId?: string;
  // HTTP uploads are not restricted to the original client's exact anomaly counts.
  // The offline CLI retains its original certification gate by default.
  sourceProfile?: 'original' | 'uploaded';
}): Promise<ValidatedDataset> {
  const manifest = parseManifest(
    JSON.parse(await readFile(options.manifestFile, 'utf8')) as unknown,
  );
  const files: WorkbookData[] = [];
  if (
    manifest.tenantId &&
    options.tenantId &&
    manifest.tenantId !== options.tenantId
  )
    throw new Error('Source manifest target tenant mismatch');
  for (const entry of manifest.files) {
    const input = { ...entry, path: resolve(options.sourceRoot, entry.path) };
    files.push(await readWorkbook(options.sourceRoot, input));
  }
  let links: ApprovedLink[] = [],
    matchManifestSha256: string | null = null;
  if (options.matchFile) {
    if (manifest.allUnlinked)
      throw new Error('Cannot supply matches to all-unlinked dataset');
    const bytes = await readFile(options.matchFile);
    matchManifestSha256 = bytesSha(bytes);
    if (matchManifestSha256 !== manifest.matchManifestSha256)
      throw new Error('Match manifest checksum mismatch');
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    const target = options.tenantId ?? manifest.tenantId;
    if (!target) throw new Error('Matching requires explicit tenant binding');
    links = validateMatches(value, manifest, files, target);
  } else if (!manifest.allUnlinked || manifest.matchManifestSha256)
    throw new Error('Missing required approved match manifest');
  const observations = profile(files);
  const discrepancies: string[] = [];
  if (options.sourceProfile !== 'uploaded') {
    for (const f of files) {
      const expected =
        EXPECTED_ROWS[f.input.year][f.input.kind === 'INSURER' ? 0 : 1];
      if (f.rows.length !== expected)
        discrepancies.push(
          `${f.input.year}/${f.input.kind}: observed ${f.rows.length}, expected ${expected}`,
        );
    }
    const expectedProfile = {
      totalRows: 16521,
      identicalGroups: 23,
      identicalRows: 58,
      negativeNumericCells: 38,
      epochDateCells: 1664,
      extremeYearCells: 17,
      reversedCoverageRows: 178,
    };
    for (const [key, expected] of Object.entries(expectedProfile))
      if (observations[key] !== expected)
        discrepancies.push(
          `${key}: observed ${observations[key]}, expected ${expected}`,
        );
  }
  const contentManifestSha256 = sha({
    contractVersion: CONTRACT,
    datasetKey: manifest.datasetKey,
    allUnlinked: manifest.allUnlinked,
    matchManifestSha256,
    files: files
      .map((f) => ({
        kind: f.input.kind,
        year: f.input.year,
        sha256: f.sha256,
        sheetName: f.sheetName,
        headerSha256: f.headerSha256,
      }))
      .sort((a, b) => canonical(a).localeCompare(canonical(b))),
  });
  return {
    manifest,
    files,
    links,
    contentManifestSha256,
    matchManifestSha256,
    observations,
    discrepancies,
  };
}
export function datasetReport(d: ValidatedDataset) {
  return {
    contractVersion: CONTRACT,
    datasetKey: d.manifest.datasetKey,
    datasetVersion: d.manifest.datasetVersion,
    contentManifestSha256: d.contentManifestSha256,
    matchManifestSha256: d.matchManifestSha256,
    allUnlinked: d.manifest.allUnlinked,
    linkCount: d.links.reduce((n, g) => n + g.reinsurers.length, 0),
    observations: d.observations,
    discrepancies: d.discrepancies,
    files: d.files.map((f) => ({
      fileName: f.fileName,
      sha256: f.sha256,
      kind: f.input.kind,
      year: f.input.year,
      physicalRowCount: f.physicalRowCount,
      businessRowCount: f.rows.length,
      headerSha256: f.headerSha256,
      lineage: f.rows.map((r) => ({
        sourceRow: r.sourceRow,
        rowSha256: r.rowSha256,
      })),
    })),
  };
}
