import type { QueryClient } from '@tanstack/react-query';

export const reinsuranceReportsKey = ['reinsurance', 'reports'] as const;

/** Mark inactive reports stale and refetch only mounted reports after successful mutations.
 * Out-of-band DB imports are not observable: Run Filter/refresh explicitly after import.
 */
export function invalidateReinsuranceReports(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: reinsuranceReportsKey, refetchType: 'active' });
}

/** Array filters are sets: selection order must not change cache identity. */
export function reportFilterCsv(values: readonly string[]): string {
  return [...new Set(values)].sort().join(',');
}
