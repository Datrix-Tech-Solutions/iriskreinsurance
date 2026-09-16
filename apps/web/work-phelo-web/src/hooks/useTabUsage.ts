'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Counts = Record<string, number>;

function readCounts(storageKey: string): Counts {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Counts) : {};
  } catch {
    return {};
  }
}

function writeCounts(storageKey: string, counts: Counts): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(counts));
  } catch {
    // storage full or disabled (private mode) — usage tracking is best-effort
  }
}

/**
 * Minimal usage-based ordering for a set of tabs, persisted per-browser in
 * `localStorage`. Each call to `recordUse(key)` bumps that tab's counter; the
 * returned `tabs` are sorted by counter (desc), with the original array order as
 * the tie-break so unseen tabs keep their designed position.
 *
 * The order is taken from a snapshot read once after mount, so it stays frozen
 * for the session — clicking a tab never reshuffles the strip you're looking at;
 * the new ordering takes effect on the next mount/visit. First paint (and SSR)
 * renders the default order to avoid a hydration mismatch.
 *
 * @param storageKey  unique key for this tab set (e.g. `"profile-tabs-usage"`)
 * @param tabs        the tabs in their default/designed order
 * @param pinFirst    keep `tabs[0]` locked in slot 0 (a stable "home" tab)
 */
export function useTabUsage<T extends { key: string }>(
  storageKey: string,
  tabs: T[],
  { pinFirst = true }: { pinFirst?: boolean } = {},
): { tabs: T[]; recordUse: (key: string) => void } {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    setCounts(readCounts(storageKey));
  }, [storageKey]);

  const ordered = useMemo(() => {
    if (!counts) return tabs;
    const defaultIndex = new Map(tabs.map((t, i) => [t.key, i]));
    const rest = [...tabs];
    const head = pinFirst ? rest.splice(0, 1) : [];
    rest.sort((a, b) => {
      const byUse = (counts[b.key] ?? 0) - (counts[a.key] ?? 0);
      if (byUse !== 0) return byUse;
      return (defaultIndex.get(a.key) ?? 0) - (defaultIndex.get(b.key) ?? 0);
    });
    return [...head, ...rest];
  }, [counts, tabs, pinFirst]);

  const recordUse = useCallback(
    (key: string) => {
      // Read-modify-write against the live value; deliberately does not touch
      // `counts` state, so the on-screen order holds until the next mount.
      const next = readCounts(storageKey);
      next[key] = (next[key] ?? 0) + 1;
      writeCounts(storageKey, next);
    },
    [storageKey],
  );

  return { tabs: ordered, recordUse };
}
