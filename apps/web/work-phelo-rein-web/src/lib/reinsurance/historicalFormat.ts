const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a source decimal string for display without going through Number, so large values
 * and the source's precision are preserved. Trailing zeros are trimmed down to 2 decimals.
 */
export function fmtDecimal(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return value;
  const [, sign, int, frac = ''] = match;
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let decimals = frac.replace(/0+$/, '');
  if (decimals.length < 2) decimals = decimals.padEnd(2, '0');
  return `${sign}${grouped}.${decimals}`;
}

/**
 * Source dates are calendar strings (YYYY-MM-DD, occasionally with a BC suffix) and can be
 * out-of-range (1970 sentinels, year 0021 or 2925), so they are formatted from the string
 * rather than a JS Date.
 */
export function fmtSourceDate(value: string | null | undefined): string {
  if (!value) return '—';
  const match = /^(\d{1,6})-(\d{2})-(\d{2})(.*)$/.exec(value);
  if (!match) return value;
  const [, year, month, day, suffix] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return value;
  return `${day} ${monthName} ${year}${suffix}`;
}
