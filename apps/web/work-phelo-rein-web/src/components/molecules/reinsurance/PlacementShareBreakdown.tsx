'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { cardClass, cn } from '@/lib/utils';

export interface ShareBreakdownEntry {
  id: string;
  label: string;
  value: number;
  color: string;
  isPlaced: boolean;
}

interface PlacementShareBreakdownProps {
  total: number;
  totalLabel: string;
  entries: ShareBreakdownEntry[];
  onAddReinsurers: () => void;
  isAdding?: boolean;
}

interface ShareSegmentProps {
  leftPct: number;
  widthPct: number;
  color: string;
  delayMs: number;
  roundedLeft: boolean;
  roundedRight: boolean;
}

/**
 * Absolutely positioned at a fixed `leftPct` (not animated) so its slot never
 * shifts as sibling segments animate — only `width` transitions, giving a
 * clean in-place fill instead of segments jostling each other via flex reflow.
 * Because `leftPct` is the *final* cumulative offset, `delayMs` must cover the
 * full duration of every prior segment's animation (not just a small stagger),
 * otherwise this segment starts growing while an earlier one is still short of
 * that offset, leaving a visible gap until it catches up.
 * Own mount state per segment (rather than one shared flag on the parent) so a
 * segment added later — a newly placed reinsurer — also grows in from 0
 * instead of appearing already at its target width.
 */
function ShareSegment({
  leftPct,
  widthPct,
  color,
  delayMs,
  roundedLeft,
  roundedRight,
}: ShareSegmentProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      style={{
        left: `${leftPct}%`,
        width: mounted ? `${widthPct}%` : '0%',
        backgroundColor: color,
        transitionDelay: `${delayMs}ms`,
      }}
      className={cn(
        'absolute inset-y-0 transition-all duration-500',
        roundedLeft && 'rounded-l-full',
        roundedRight && 'rounded-r-full',
      )}
    />
  );
}

export function PlacementShareBreakdown({
  total,
  totalLabel,
  entries,
  onAddReinsurers,
  isAdding = false,
}: PlacementShareBreakdownProps) {
  const placedEntries = entries.filter((e) => e.isPlaced);
  const placedPct = +placedEntries.reduce((sum, e) => sum + e.value, 0).toFixed(4);
  const availablePct = Math.max(0, +(total - placedPct).toFixed(4));

  return (
    <div className={cardClass('p-5 flex flex-col gap-4')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-gray-900">Placement Share Breakdown</h3>
          <p className="text-xs text-gray-400">
            Distributed offers of the {totalLabel}{' '}
            <span className="font-semibold text-gray-600">{total}%</span>
          </p>
        </div>
        {availablePct > 0 && (
          <Button size="sm" onClick={onAddReinsurers} isLoading={isAdding}>
            Add Reinsurers
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-medium text-gray-500">
          <span>Placed Capacity</span>
          <span>
            <span className="text-gray-700">{placedPct}%</span>
            <span className="text-gray-400"> / {total}%</span>
          </span>
        </div>

        <div className="relative h-2.5 rounded-full bg-gray-100 overflow-hidden">
          {placedEntries.map((entry, index) => {
            const priorValue = placedEntries.slice(0, index).reduce((sum, e) => sum + e.value, 0);
            return (
              <ShareSegment
                key={entry.id}
                leftPct={total > 0 ? (priorValue / total) * 100 : 0}
                widthPct={total > 0 ? (entry.value / total) * 100 : 0}
                color={entry.color}
                delayMs={index * 500}
                roundedLeft={index === 0}
                roundedRight={index === placedEntries.length - 1}
              />
            );
          })}
        </div>

        <p className="text-xs text-gray-400">
          Available: <span className="font-semibold text-gray-600">{availablePct}%</span>
        </p>

        {entries.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span
                  className="text-xs"
                  style={{ color: entry.isPlaced ? entry.color : undefined }}
                >
                  <span className={entry.isPlaced ? 'font-medium' : 'text-gray-400'}>
                    {entry.label}
                  </span>
                  {entry.isPlaced && (
                    <span className="text-gray-400 font-normal"> · {entry.value}%</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
