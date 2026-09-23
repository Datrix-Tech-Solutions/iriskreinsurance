const XML_CHARACTERS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function csvToExcelHtml(csv: string, sheetTitle: string): string {
  const rows = parseCsv(csv);
  const safeTitle = escapeHtml(sheetTitle);
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('');

  return [
    '<!doctype html>',
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ',
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ',
    'xmlns="http://www.w3.org/TR/REC-html40">',
    '<head>',
    '<meta charset="utf-8" />',
    `<title>${safeTitle}</title>`,
    '</head>',
    '<body>',
    `<table>${body}</table>`,
    '</body>',
    '</html>',
  ].join('');
}

export function formatExportDate(
  value: string | Date | null | undefined,
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function formatExportPeriod(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  const formattedStart = formatExportDate(start);
  const formattedEnd = formatExportDate(end);
  if (!formattedStart && !formattedEnd) return '';
  return `${formattedStart} - ${formattedEnd}`;
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_CHARACTERS[char] ?? char);
}
