// Synthetic fixtures only: no historical source values or approval records.
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CE_HEADERS,
  RE_HEADERS,
  CONTRACT,
  ValidatedDataset,
  bytesSha,
  column,
  sha,
} from './source-contract';
import { readWorkbook } from './workbook-reader';

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function zip(parts: Record<string, string>): Buffer {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(parts)) {
    const n = Buffer.from(name),
      b = Buffer.from(value),
      crc = crc32(b),
      h = Buffer.alloc(30),
      c = Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(b.length, 18);
    h.writeUInt32LE(b.length, 22);
    h.writeUInt16LE(n.length, 26);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(b.length, 20);
    c.writeUInt32LE(b.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    local.push(h, n, b);
    central.push(c, n);
    offset += h.length + n.length + b.length;
  }
  const tail = Buffer.alloc(22),
    directory = Buffer.concat(central);
  tail.writeUInt32LE(0x06054b50);
  tail.writeUInt16LE(central.length / 2, 8);
  tail.writeUInt16LE(central.length / 2, 10);
  tail.writeUInt32LE(directory.length, 12);
  tail.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, tail]);
}
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export function workbook(
  kind: 'INSURER' | 'REINSURER',
  label = 'synthetic',
  mutate?: (parts: Record<string, string>) => void,
) {
  const headers = kind === 'INSURER' ? CE_HEADERS : RE_HEADERS;
  const values =
    kind === 'INSURER'
      ? [
          'POL-' + label,
          'Cedant',
          label,
          'Motor',
          '01-01-1970',
          '01-02-2025',
          '01-03-2925',
          '01-02-0021',
          'GHS',
          ...Array<string>(18).fill('1'),
          'OPEN',
          'UNPAID',
        ]
      : [
          'POL-' + label,
          'Reinsurer',
          label,
          'Motor',
          'Cedant',
          '01-01-1970',
          '01-02-2025',
          '01-03-2925',
          '01-02-0021',
          'USD',
          ...Array<string>(17).fill('1'),
          'PENDING',
          'UNPAID',
        ];
  values[kind === 'INSURER' ? 9 : 10] = '-123456789012345.123456789012';
  if (kind === 'REINSURER') {
    values[21] = '12.34';
    values[22] = '56.78';
  }
  const row = (r: number, items: string[]) =>
    `<row r="${r}">${items.map((v, i) => `<c r="${column(i + 1)}${r}" t="inlineStr"><is><t>${escape(v)}</t></is></c>`).join('')}</row>`;
  const parts: Record<string, string> = {
    'xl/workbook.xml':
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Brokerage Statement" r:id="r1"/><sheet name="Total Currencies" r:id="r2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="worksheets/sheet2.xml"/></Relationships>',
    'xl/styles.xml':
      '<styleSheet><cellXfs><xf numFmtId="0"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${row(1, headers)}${row(2, values)}${row(3, values)}</sheetData></worksheet>`,
    'xl/worksheets/sheet2.xml': '<worksheet><sheetData/></worksheet>',
  };
  mutate?.(parts);
  return zip(parts);
}
export async function syntheticDataset(
  version = 'v1',
  tenantId = 'archive-test-tenant',
): Promise<{ root: string; data: ValidatedDataset }> {
  const root = await mkdtemp(join(tmpdir(), 'irisk-archive-fixture-'));
  const files = [];
  for (let year = 2021; year <= 2025; year++)
    for (const kind of ['INSURER', 'REINSURER'] as const) {
      const path = join(root, `${year}-${kind}.xlsx`),
        bytes = workbook(kind, `${year}-${version}`);
      await writeFile(path, bytes);
      files.push(
        await readWorkbook(root, { path, year, kind, sha256: bytesSha(bytes) }),
      );
    }
  return {
    root,
    data: {
      manifest: {
        contractVersion: CONTRACT,
        datasetKey: 'synthetic-dataset',
        datasetVersion: version,
        tenantId,
        allUnlinked: true,
        files: files.map((f) => f.input),
      },
      files,
      links: [],
      matchManifestSha256: null,
      contentManifestSha256: sha(files.map((f) => f.sha256)),
      observations: { synthetic: 1 },
      discrepancies: [],
    },
  };
}
