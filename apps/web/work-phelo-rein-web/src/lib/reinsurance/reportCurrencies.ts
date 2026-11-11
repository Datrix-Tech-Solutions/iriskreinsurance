/** The report, not independently permissioned settings, owns monetary population. */
export function reportCurrencyRows(
  amounts: ReadonlyMap<string, number>,
  subAmounts?: ReadonlyMap<string, number>,
  metadata: ReadonlyArray<{ isoCode: string }> = [],
): Array<{ id: string; isoCode: string; amount: number | null; subAmount: number | null }> {
  const codes = new Set([...amounts.keys(), ...(subAmounts?.keys() ?? [])]);
  const known = metadata.map((row) => row.isoCode).filter((code) => codes.has(code));
  const ordered = [...new Set([...known, ...[...codes].sort()])];
  return ordered.map((code) => ({
    id: code,
    isoCode: code,
    amount: amounts.get(code) ?? null,
    subAmount: subAmounts?.get(code) ?? null,
  }));
}

export function reportCurrencyOptions(
  metadata: Array<{ value: string; label: string }>,
  codes: Iterable<string>,
): Array<{ value: string; label: string }> {
  const result = new Map(metadata.map((option) => [option.value, option]));
  for (const code of [...new Set(codes)].sort())
    if (!result.has(code)) result.set(code, { value: code, label: code });
  return [...result.values()];
}
