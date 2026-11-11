import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { hashKey, useQueryClient, type QueryKey } from '@tanstack/react-query';

/** Normalized keys, not draft controls, define whether Run Filter is a refresh. */
export function sameAppliedReport<P>(
  previous: P | null,
  next: P | null,
  key: (params: P) => QueryKey,
): boolean {
  return previous !== null && next !== null && hashKey(key(previous)) === hashKey(key(next));
}

export function useAppliedReportParams<P>(
  key: (params: P) => QueryKey,
): [P | null, Dispatch<SetStateAction<P | null>>] {
  const client = useQueryClient();
  const [params, setParams] = useState<P | null>(null);
  const current = useRef<P | null>(null);
  const apply: Dispatch<SetStateAction<P | null>> = (action) => {
    const next =
      typeof action === 'function'
        ? (action as (prev: P | null) => P | null)(current.current)
        : action;
    // Run Filter (a complete object) must refresh even when returning to a
    // different, still-fresh cached page. Functional updates are pagination.
    const refresh = typeof action !== 'function' || sameAppliedReport(current.current, next, key);
    current.current = next;
    setParams(next);
    if (refresh && next !== null)
      void client.invalidateQueries({ queryKey: key(next), exact: true });
  };
  return [params, apply];
}
