import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readWorkbook, decimalLexeme, calendarDate } from './workbook-reader';
import { bytesSha, sha, SHEET } from './source-contract';
import { validateMatches, parseManifest, profile } from './dataset';
import { workbook, syntheticDataset } from './test-fixtures';
import { parseArgs, runArchiveCli } from '../cli/historical-statements';

async function read(
  bytes: Buffer,
  kind: 'INSURER' | 'REINSURER' = 'INSURER',
  hash = bytesSha(bytes),
) {
  const root = await mkdtemp(join(tmpdir(), 'irisk-archive-reader-'));
  const path = join(root, 'test.xlsx');
  await writeFile(path, bytes);
  return readWorkbook(root, { path, kind, year: 2021, sha256: hash });
}
describe('Exact offline archive reader', () => {
  it('retains every physical duplicate, exact decimals, epoch, extreme/reversed dates and original statuses', async () => {
    const f = await read(workbook('INSURER'));
    expect(f.rows.map((r) => r.sourceRow)).toEqual([2, 3]);
    expect(f.rows[0].fields.sumInsured100).toBe(
      '-123456789012345.123456789012',
    );
    expect(f.rows[0].fields.offerDate).toBe('1970-01-01');
    expect(f.rows[0].fields.endDate).toBe('0021-02-01');
    expect(f.rows[0].fields.offerStatus).toBe('OPEN');
    expect(profile([f])).toMatchObject({
      identicalGroups: 1,
      identicalRows: 2,
      negativeNumericCells: 2,
      reversedCoverageRows: 2,
    });
    expect(f.rows[0].rawCells).toHaveLength(29);
    expect(f.rows[0].rowSha256).toBe(sha(f.rows[0].rawCells));
  });
  it('keeps the duplicate Paid WHT V/W columns independent', async () => {
    const f = await read(workbook('REINSURER'), 'REINSURER');
    expect(f.headerCells[21].resolvedText).toBe('Paid WHT');
    expect(f.headerCells[22].resolvedText).toBe('Paid WHT');
    expect(f.rows[0].fields).toMatchObject({
      paidWhtFirst: '12.34',
      paidWhtSecond: '56.78',
      offerStatus: 'PENDING',
    });
  });
  it('distinguishes blank, missing, zero and uncached formula', async () => {
    const f = await read(
      workbook('INSURER', 'cells', (p) => {
        p['xl/worksheets/sheet1.xml'] = p['xl/worksheets/sheet1.xml']
          .replace(
            '<c r="A2" t="inlineStr"><is><t>POL-cells</t></is></c>',
            '<c r="A2"/>',
          )
          .replace('<c r="B2" t="inlineStr"><is><t>Cedant</t></is></c>', '')
          .replace(
            '<c r="J2" t="inlineStr"><is><t>-123456789012345.123456789012</t></is></c>',
            '<c r="J2"><v>0</v></c>',
          )
          .replace(
            '<c r="C2" t="inlineStr"><is><t>cells</t></is></c>',
            '<c r="C2"><f>A2</f></c>',
          );
      }),
    );
    expect(f.rows[0].rawCells[0].state).toBe('BLANK');
    expect(f.rows[0].rawCells[1].state).toBe('MISSING');
    expect(f.rows[0].fields.sumInsured100).toBe('0');
    expect(f.rows[0].rawCells[2].formula).toBe('A2');
  });
  it('rejects changed bytes, duplicate physical rows/cells, traversal, external references and DTDs', async () => {
    await expect(
      read(workbook('INSURER'), 'INSURER', '0'.repeat(64)),
    ).rejects.toThrow('checksum');
    for (const mutate of [
      (p: Record<string, string>) => {
        p['xl/worksheets/sheet1.xml'] = p['xl/worksheets/sheet1.xml'].replace(
          '<row r="3">',
          '<row r="2">',
        );
      },
      (p: Record<string, string>) => {
        p['xl/worksheets/sheet1.xml'] = p['xl/worksheets/sheet1.xml'].replace(
          '<row r="2">',
          '<row r="2"><c r="A2"/>',
        );
      },
      (p: Record<string, string>) => {
        p['../unsafe.xml'] = '<x/>';
      },
      (p: Record<string, string>) => {
        p['xl/_rels/workbook.xml.rels'] = p[
          'xl/_rels/workbook.xml.rels'
        ].replace('Id="r1"', 'Id="r1" TargetMode="External"');
      },
      (p: Record<string, string>) => {
        p['xl/workbook.xml'] =
          '<!DOCTYPE workbook [<!ENTITY secret "oops">]>' +
          p['xl/workbook.xml'];
      },
    ])
      await expect(read(workbook('INSURER', 'bad', mutate))).rejects.toThrow();
  });
  it.each([
    '1.1234567890123',
    '1000000000000000000',
    '1,00',
    'NaN',
    'Infinity',
  ])('rejects unsupported numeric %s without rounding', (s) =>
    expect(() => decimalLexeme(s)).toThrow(),
  );
  it('parses exact exponents and calendar dates without timezone or float conversion', () => {
    expect(decimalLexeme('1,234.123456789012')).toBe('1234.123456789012');
    expect(decimalLexeme('123e-12')).toBe('0.000000000123');
    expect(calendarDate('29-02-2024')).toBe('2024-02-29');
    expect(calendarDate('29-02-2023')).toBeNull();
  });
  it('requires explicit source identity and prevents repeated year/kind inputs', async () => {
    const { data } = await syntheticDataset();
    expect(parseManifest(data.manifest).files).toHaveLength(10);
    await expect(
      Promise.resolve().then(() =>
        parseManifest({
          ...data.manifest,
          files: [data.manifest.files[0], ...data.manifest.files.slice(0, 9)],
        }),
      ),
    ).rejects.toThrow('Duplicate');
  });
  it('accepts approved one-to-many physical links, rejecting all ambiguous/forged ownership', async () => {
    const { data } = await syntheticDataset();
    const ce = data.files[0],
      re = data.files[1];
    const ref = (f: typeof ce, row: number) => ({
      fileSha256: f.sha256,
      sheet: SHEET,
      sourceRow: row,
      rowSha256: f.rows.find((r) => r.sourceRow === row)!.rowSha256,
    });
    const group = {
      matchId: 'synthetic-approval',
      insurer: ref(ce, 2),
      reinsurers: [ref(re, 2), ref(re, 3)],
      basis: 'SUPPLIED_AUTHORITATIVE',
      approvalRef: 'synthetic test only',
      approvedByUserId: 'test-admin',
      approvedAt: '2026-11-05T00:00:00.000Z',
      evidence: { synthetic: true },
    };
    const manifest = {
      contractVersion: 'historical-statement-links/v1',
      tenantId: data.manifest.tenantId,
      datasetKey: data.manifest.datasetKey,
      datasetVersion: data.manifest.datasetVersion,
      groups: [group],
    };
    expect(
      validateMatches(
        manifest,
        data.manifest,
        data.files,
        data.manifest.tenantId!,
      ),
    ).toHaveLength(1);
    for (const invalid of [
      { ...manifest, tenantId: 'other' },
      { ...manifest, unapprovedCandidates: [{}] },
      {
        ...manifest,
        groups: [{ ...group, reinsurers: [ref(re, 2), ref(re, 2)] }],
      },
      {
        ...manifest,
        groups: [
          { ...group, insurer: { ...ref(ce, 2), rowSha256: '0'.repeat(64) } },
        ],
      },
      {
        ...manifest,
        groups: [group, { ...group, matchId: 'another', insurer: ref(ce, 3) }],
      },
    ])
      expect(() =>
        validateMatches(
          invalid,
          data.manifest,
          data.files,
          data.manifest.tenantId!,
        ),
      ).toThrow();
  });
  it('CLI rejects unknown/repeated arguments and never obtains a database in offline mode', async () => {
    expect(() =>
      parseArgs(['--mode', 'validate', '--mode', 'apply']),
    ).toThrow();
    expect(() => parseArgs(['--allow-apply'])).toThrow();
    await expect(
      runArchiveCli(
        [
          '--mode',
          'validate',
          '--output-file',
          '/tmp/test',
          '--allow-archive-write',
        ],
        {},
      ),
    ).rejects.toThrow('Write authorizations');
  });
});
