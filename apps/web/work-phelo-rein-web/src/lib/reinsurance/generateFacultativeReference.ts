const CORPORATE_STOP_WORDS = new Set([
  'ltd',
  'limited',
  'llc',
  'inc',
  'incorporated',
  'plc',
  'corp',
  'corporation',
  'co',
  'company',
  'group',
  'the',
  'and',
]);

/** Derives a short uppercase identifier from a company name, e.g. "Accra Re Brokers Ltd" -> "ARB". */
export function abbreviateCompanyName(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const significant = words.filter((w) => !CORPORATE_STOP_WORDS.has(w.toLowerCase()));
  const source = significant.length > 0 ? significant : words;

  if (source.length === 0) return 'GEN';
  if (source.length === 1) return source[0].slice(0, 3).toUpperCase();
  return source
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);
}

export function buildFacultativeReferencePrefix(tenantName: string, year: number): string {
  return `FAC-${abbreviateCompanyName(tenantName)}-${year}`;
}

export function buildFacultativeReference(
  tenantName: string,
  year: number,
  orderNumber: number,
): string {
  const order = String(Math.max(orderNumber, 1)).padStart(4, '0');
  return `${buildFacultativeReferencePrefix(tenantName, year)}-${order}`;
}
