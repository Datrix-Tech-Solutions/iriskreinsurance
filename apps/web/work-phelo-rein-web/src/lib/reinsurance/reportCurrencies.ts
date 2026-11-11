/** The report, not independently permissioned settings, owns monetary population. */
export function reportCurrencyRows(
  amounts: ReadonlyMap<string, number>,
  subAmounts?: ReadonlyMap<string, number>,
): Array<{ id: string; isoCode: string; amount: number | null; subAmount: number | null }> {
  return [...new Set([...amounts.keys(), ...(subAmounts?.keys() ?? [])])].sort().map((code) => ({
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
  for (const code of codes) if (!result.has(code)) result.set(code, { value: code, label: code });
  return [...result.values()].sort((a, b) => a.value.localeCompare(b.value));
}
