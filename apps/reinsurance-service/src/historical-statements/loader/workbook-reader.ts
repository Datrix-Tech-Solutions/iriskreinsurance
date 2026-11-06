import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, posix, relative, sep } from 'node:path';
import * as yauzl from 'yauzl';
import * as sax from 'sax';
import { Prisma } from '../../../prisma/generated/client';
import {
  CE_FIELDS,
  CE_HEADERS,
  DATE_FIELDS,
  RE_FIELDS,
  RE_HEADERS,
  RawCell,
  SourceFileInput,
  SourceRow,
  WorkbookData,
  bytesSha,
  column,
  sha,
} from './source-contract';

interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}
export const READER_LIMITS = {
  compressed: 64 * 1024 * 1024,
  inflated: 256 * 1024 * 1024,
  entries: 10000,
  rows: 100000,
  token: 1024 * 1024,
  nodes: 2000000,
};
const local = (s: string) => s.split(':').at(-1)!;
function xml(buffer: Buffer): XmlNode {
  const parserOptions = { trim: false, normalize: false, strictEntities: true };
  const parser = sax.parser(true, parserOptions);
  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;
  let count = 0;
  parser.ondoctype = () => {
    throw new Error('DTD/entity declarations forbidden');
  };
  parser.onsgmldeclaration = () => {
    throw new Error('SGML declarations forbidden');
  };
  parser.onopentag = (tag) => {
    if (++count > READER_LIMITS.nodes || stack.length >= 64)
      throw new Error('XML resource limit');
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(tag.attributes)) {
      if (typeof v !== 'string')
        throw new Error('Unsupported XML attribute representation');
      attrs[k] = v;
    }
    const node: XmlNode = {
      name: local(tag.name),
      attrs,
      children: [],
      text: '',
    };
    if (stack.length) stack.at(-1)!.children.push(node);
    else if (root) throw new Error('Multiple XML roots');
    else root = node;
    stack.push(node);
  };
  const append = (s: string) => {
    const n = stack.at(-1);
    if (n) {
      if (n.text.length + s.length > READER_LIMITS.token)
        throw new Error('XML text limit');
      n.text += s;
    }
  };
  parser.ontext = append;
  parser.oncdata = append;
  parser.onclosetag = () => {
    stack.pop();
  };
  parser.onerror = (e) => {
    throw new Error(`Invalid source XML: ${e.message.slice(0, 80)}`);
  };
  // Chunking prevents SAX's own bounded text buffers from growing unbounded.
  const input = buffer.toString('utf8');
  for (let i = 0; i < input.length; i += 32768)
    parser.write(input.slice(i, i + 32768));
  parser.close();
  if (!root || stack.length) throw new Error('Incomplete XML');
  return root;
}
const child = (n: XmlNode, name: string) =>
  n.children.find((c) => c.name === name);
const all = (n: XmlNode, name: string): XmlNode[] =>
  n.children.filter((c) => c.name === name);
function texts(n: XmlNode): string {
  return n.name === 't'
    ? n.text
    : n.children
        .filter((c) => c.name !== 'rPh')
        .map(texts)
        .join('');
}
function safePart(name: string): boolean {
  return (
    !name.includes('\\') &&
    !name.startsWith('/') &&
    !name.split('/').includes('..') &&
    !name.includes('\0')
  );
}
async function unzip(bytes: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      bytes,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, zip) => {
        if (error || !zip) {
          reject(new Error('Invalid or encrypted XLSX ZIP'));
          return;
        }
        const parts = new Map<string, Buffer>();
        const seen = new Set<string>();
        let inflated = 0;
        let entries = 0;
        let failed = false;
        const fail = (err: Error) => {
          if (!failed) {
            failed = true;
            zip.close();
            reject(err);
          }
        };
        zip.on('error', () => fail(new Error('Invalid XLSX ZIP stream')));
        zip.on('entry', (entry: yauzl.Entry) => {
          if (failed) return;
          if (
            ++entries > READER_LIMITS.entries ||
            !safePart(entry.fileName) ||
            seen.has(entry.fileName) ||
            entry.generalPurposeBitFlag & 1 ||
            ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000
          ) {
            fail(new Error('Unsafe XLSX ZIP entry'));
            return;
          }
          seen.add(entry.fileName);
          inflated += entry.uncompressedSize;
          if (inflated > READER_LIMITS.inflated) {
            fail(new Error('XLSX inflated size limit'));
            return;
          }
          if (/vbaProject|externalLinks|embeddings/i.test(entry.fileName)) {
            fail(new Error('Active/external workbook content forbidden'));
            return;
          }
          const wanted =
            entry.fileName.endsWith('.xml') || entry.fileName.endsWith('.rels');
          if (!wanted) {
            if (/vbaProject|externalLinks|embeddings/i.test(entry.fileName)) {
              fail(new Error('Active/external workbook content forbidden'));
              return;
            }
            zip.readEntry();
            return;
          }
          zip.openReadStream(entry, (err, stream) => {
            if (err || !stream) {
              fail(new Error('Unable to read XLSX entry'));
              return;
            }
            const chunks: Buffer[] = [];
            let bytes = 0;
            stream.on('data', (chunk: Buffer) => {
              bytes += chunk.length;
              if (
                bytes > entry.uncompressedSize ||
                bytes > READER_LIMITS.inflated
              ) {
                stream.destroy();
                fail(new Error('XLSX entry size mismatch'));
              } else chunks.push(chunk);
            });
            stream.on('error', () =>
              fail(new Error('Invalid XLSX entry bytes')),
            );
            stream.on('end', () => {
              if (failed) return;
              if (bytes !== entry.uncompressedSize) {
                fail(new Error('Truncated XLSX entry'));
                return;
              }
              parts.set(entry.fileName, Buffer.concat(chunks));
              zip.readEntry();
            });
          });
        });
        zip.on('end', () => {
          if (!failed) resolve(parts);
        });
        zip.readEntry();
      },
    );
  });
}
export function decimalLexeme(value: string): string {
  const s = value.trim();
  if (
    s.length > 512 ||
    !/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?(?:[eE][+-]?\d{1,4})?$/.test(s)
  )
    throw new Error('Unsupported numeric lexeme');
  const clean = s.replace(/,/g, '');
  const [mantissa, expText] = clean.toLowerCase().split('e');
  const exponent = expText === undefined ? 0 : Number(expText);
  const scale = Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - exponent);
  const d = new Prisma.Decimal(clean);
  if (!d.isFinite() || scale > 12 || (d.isZero() ? 1 : d.e + 1) > 18)
    throw new Error('Numeric value exceeds Decimal(30,12); rounding forbidden');
  return d.toFixed(Math.max(0, d.decimalPlaces()));
}
export function calendarDate(value: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!m) return null;
  const day = Number(m[1]),
    month = Number(m[2]),
    year = Number(m[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1])
    return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
export async function confinedPath(
  root: string,
  input: string,
): Promise<string> {
  const [base, p] = await Promise.all([realpath(root), realpath(input)]);
  const rel = relative(base, p);
  if (rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith(sep))
    throw new Error('Source path escapes approved root');
  return p;
}
export async function readWorkbook(
  root: string,
  input: SourceFileInput,
): Promise<WorkbookData> {
  const path = await confinedPath(root, input.path);
  const size = (await stat(path)).size;
  if (size > READER_LIMITS.compressed)
    throw new Error('XLSX compressed size limit');
  const original = await readFile(path);
  const hash = bytesSha(original);
  if (hash !== input.sha256) throw new Error('Workbook checksum mismatch');
  if (original.length !== size)
    throw new Error('Workbook changed during initial read');
  const parts = await unzip(original);
  const parsed = new Map<string, XmlNode>();
  const part = (name: string) => {
    const b = parts.get(name);
    if (!b) throw new Error(`Missing workbook part ${name}`);
    let n = parsed.get(name);
    if (!n) {
      n = xml(b);
      parsed.set(name, n);
    }
    return n;
  };
  // Inspect every relationship, not merely the ones followed by this reader.
  for (const name of parts.keys())
    if (name.endsWith('.rels'))
      for (const rel of all(part(name), 'Relationship'))
        if (
          rel.attrs.TargetMode === 'External' ||
          /externalLink|hyperlink/i.test(rel.attrs.Type ?? '')
        )
          throw new Error('External workbook relationship forbidden');
  const wb = part('xl/workbook.xml');
  if (wb.name !== 'workbook') throw new Error('Invalid workbook root');
  const sheets = all(child(wb, 'sheets') ?? wb, 'sheet');
  if (
    sheets.length !== 2 ||
    sheets
      .map((s) => s.attrs.name)
      .sort()
      .join('|') !== 'Brokerage Statement|Total Currencies'
  )
    throw new Error('Unsupported workbook sheet contract');
  const targets = new Map(
    all(part('xl/_rels/workbook.xml.rels'), 'Relationship').map((r) => [
      r.attrs.Id,
      r.attrs.Target,
    ]),
  );
  const shared = parts.has('xl/sharedStrings.xml')
    ? all(part('xl/sharedStrings.xml'), 'si').map(texts)
    : [];
  const style = part('xl/styles.xml');
  const formats = Object.fromEntries(
    all(child(style, 'numFmts') ?? style, 'numFmt').map((n) => [
      n.attrs.numFmtId,
      n.attrs.formatCode,
    ]),
  );
  const xfs = all(child(style, 'cellXfs') ?? style, 'xf').map(
    (x) => x.attrs.numFmtId ?? '0',
  );
  function sheetPath(sheet: XmlNode): string {
    const target = targets.get(sheet.attrs['r:id']);
    if (!target || target.includes('://'))
      throw new Error('Invalid worksheet relationship');
    const p = posix.normalize(
      target.startsWith('/') ? target.slice(1) : posix.join('xl', target),
    );
    if (!safePart(p) || !p.startsWith('xl/worksheets/'))
      throw new Error('Unsafe worksheet relationship');
    return p;
  }
  function parseRows(n: XmlNode): { sourceRow: number; raw: RawCell[] }[] {
    const data = child(n, 'sheetData');
    if (!data) throw new Error('Worksheet data missing');
    const rows = all(data, 'row');
    if (rows.length > READER_LIMITS.rows + 1)
      throw new Error('Workbook row limit');
    const seenRows = new Set<number>();
    return rows.map((r) => {
      const sourceRow = Number(r.attrs.r);
      if (
        !Number.isSafeInteger(sourceRow) ||
        sourceRow < 1 ||
        sourceRow > READER_LIMITS.rows + 1 ||
        seenRows.has(sourceRow)
      )
        throw new Error('Duplicate/invalid physical source row');
      seenRows.add(sourceRow);
      const cells = new Map<string, XmlNode>();
      for (const c of all(r, 'c')) {
        const address = c.attrs.r;
        if (
          cells.has(address) ||
          !new RegExp(`^(?:[A-Z]|A[ABC])${sourceRow}$`).test(address)
        )
          throw new Error('Duplicate/out-of-range physical cell');
        cells.set(address, c);
      }
      const raw = Array.from({ length: 29 }, (_, i): RawCell => {
        const col = column(i + 1),
          address = col + sourceRow,
          c = cells.get(address);
        const v = c && child(c, 'v'),
          f = c && child(c, 'f'),
          inline = c && child(c, 'is');
        const xmlValue = v?.text ?? null;
        const styleIndex = c?.attrs.s === undefined ? null : Number(c.attrs.s);
        if (
          styleIndex !== null &&
          (!Number.isSafeInteger(styleIndex) ||
            styleIndex < 0 ||
            styleIndex >= xfs.length)
        )
          throw new Error('Invalid source style reference');
        let resolvedText = xmlValue;
        let type: RawCell['type'] = null;
        if (c) {
          switch (c.attrs.t ?? 'n') {
            case 's': {
              if (
                xmlValue === null ||
                !/^\d+$/.test(xmlValue) ||
                shared[Number(xmlValue)] === undefined
              )
                throw new Error('Invalid shared string reference');
              resolvedText = shared[Number(xmlValue)];
              type = 'SHARED_STRING';
              break;
            }
            case 'inlineStr':
              resolvedText = inline ? texts(inline) : null;
              type = 'INLINE_STRING';
              break;
            case 'n':
              type = 'NUMBER';
              break;
            case 'b':
              type = 'BOOLEAN';
              break;
            case 'e':
              type = 'ERROR';
              break;
            case 'str':
              type = 'INLINE_STRING';
              break;
            default:
              throw new Error('Unsupported source cell type');
          }
        }
        if (f) type = 'FORMULA';
        return {
          columnIndex: i + 1,
          columnLetter: col,
          sourceAddress: address,
          state: !c
            ? 'MISSING'
            : resolvedText === null || resolvedText === ''
              ? 'BLANK'
              : 'VALUE',
          type,
          xmlValue,
          resolvedText,
          styleIndex,
          formula: f?.text ?? null,
          formulaAttributes: f?.attrs ?? null,
          cachedValue: f ? xmlValue : null,
        };
      });
      return { sourceRow, raw };
    });
  }
  const main = sheets.find((s) => s.attrs.name === 'Brokerage Statement')!;
  const pathInZip = sheetPath(main);
  const data = parseRows(part(pathInZip));
  const header = data.find((r) => r.sourceRow === 1)?.raw;
  if (!header) throw new Error('Header row1 missing');
  const expected = input.kind === 'INSURER' ? CE_HEADERS : RE_HEADERS;
  if (header.some((c, i) => c.resolvedText !== expected[i]))
    throw new Error('Ordered physical header mismatch');
  const fields = input.kind === 'INSURER' ? CE_FIELDS : RE_FIELDS;
  const numericStart = input.kind === 'INSURER' ? 9 : 10;
  const rows: SourceRow[] = [];
  for (const r of data) {
    if (r.sourceRow === 1) continue;
    if (!r.raw.some((c) => c.state === 'VALUE' || c.formula !== null)) continue;
    const out: SourceRow = {
      sourceRow: r.sourceRow,
      rowSha256: sha(r.raw),
      rawCells: r.raw,
      fields: {},
      qualityFlags: [],
    };
    fields.forEach((field, i) => {
      const c = r.raw[i],
        v = c.resolvedText;
      if (c.type === 'ERROR')
        out.qualityFlags.push({
          code: 'SOURCE_CELL_ERROR',
          columnIndex: i + 1,
          sourceValue: v ?? '',
        });
      if (DATE_FIELDS.has(field)) {
        const d = v === null || v === '' ? null : calendarDate(v);
        out.fields[field] = d;
        if (v && !d)
          out.qualityFlags.push({
            code: 'INVALID_SOURCE_DATE',
            columnIndex: i + 1,
            sourceValue: v,
          });
        if (d === '1970-01-01')
          out.qualityFlags.push({
            code: 'EPOCH_SENTINEL',
            columnIndex: i + 1,
            sourceValue: v!,
          });
        if (d && (d < '1900-01-01' || d > '2100-12-31'))
          out.qualityFlags.push({
            code: 'EXTREME_SOURCE_YEAR',
            columnIndex: i + 1,
            sourceValue: v!,
          });
      } else if (i >= numericStart && i <= 26) {
        out.fields[field] =
          v === null || v === '' || c.type === 'ERROR'
            ? null
            : decimalLexeme(v);
      } else out.fields[field] = v;
      if (c.formula !== null)
        out.qualityFlags.push({
          code: 'SOURCE_FORMULA_NOT_RECALCULATED',
          columnIndex: i + 1,
        });
    });
    if (
      out.fields.startDate &&
      out.fields.endDate &&
      out.fields.endDate < out.fields.startDate
    )
      out.qualityFlags.push({ code: 'REVERSED_COVERAGE' });
    rows.push(out);
  }
  const aux = sheets.find((s) => s.attrs.name === 'Total Currencies')!;
  const auxNode = part(sheetPath(aux));
  const auxiliaryRows = all(child(auxNode, 'sheetData') ?? auxNode, 'row').map(
    (r) => ({
      row: r.attrs.r,
      cells: all(r, 'c').map((c) => ({
        address: c.attrs.r,
        type: c.attrs.t ?? 'n',
        value: child(c, 'v')?.text ?? null,
        text:
          c.attrs.t === 's'
            ? shared[Number(child(c, 'v')?.text)]
            : (child(c, 'v')?.text ?? null),
      })),
    }),
  );
  if (bytesSha(await readFile(path)) !== hash)
    throw new Error('Source changed while reading');
  return {
    input,
    fileName: basename(input.path),
    byteSize: size,
    sha256: hash,
    sheetName: 'Brokerage Statement',
    sheetXmlPath: pathInZip,
    headerSha256: sha(header),
    headerCells: header,
    physicalRowCount: Math.max(...data.map((r) => r.sourceRow)),
    rows,
    workbookMetadata: {
      date1904: child(wb, 'workbookPr')?.attrs.date1904 ?? '0',
      sheetNames: sheets.map((s) => s.attrs.name),
      numberFormats: formats,
      styleFormats: xfs,
      auxiliaryRows,
    },
  };
}
