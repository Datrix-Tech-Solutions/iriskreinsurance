'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CapacityBarRow {
  counterpartyId: string;
  reinsurerName: string;
  share: number;
}

interface CapacityBarProps {
  acceptedPercent: number;
  targetPercent: number;
  /** The offer % before this endorsement, so the target can be shown as "original + added". */
  originalPercent?: number;
  rows: CapacityBarRow[];
  colorMap: Record<string, string>;
  /** Once closed there's nothing left to track against a target — show a flat "placed" readout instead. */
  isClosed?: boolean;
}

interface CapacitySegmentProps {
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
 * segment added later — a newly accepted reinsurer — also grows in from 0
 * instead of appearing already at its target width.
 */
function CapacitySegment({
  leftPct,
  widthPct,
  color,
  delayMs,
  roundedLeft,
  roundedRight,
}: CapacitySegmentProps) {
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

/** Segmented capacity bar — one colored segment per accepted reinsurer, with a legend below. */
export function CapacityBar({
  acceptedPercent,
  targetPercent,
  originalPercent,
  rows,
  colorMap,
  isClosed = false,
}: CapacityBarProps) {
  if (targetPercent <= 0) return null;

  const delta = originalPercent != null ? +(targetPercent - originalPercent).toFixed(4) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-medium text-gray-500">
        <span>Accepted Capacity</span>
        {isClosed ? (
          <span className="text-gray-700 text-[13px] font-bold">{acceptedPercent}% placed</span>
        ) : (
          <span>
            <span className="text-gray-700 text-[13px] font-bold">{acceptedPercent}%</span>
            <span className="text-gray-400 text-[13px] font-bold"> / {targetPercent}%</span>
            {delta !== 0 && (
              <span className="text-gray-400 text-[10px] font-bold">
                {' '}
                ({originalPercent}%
                <span className={delta > 0 ? 'text-green-600' : 'text-red-500'}>
                  {' '}
                  {delta > 0 ? '+' : ''}
                  {delta}%
                </span>
                )
              </span>
            )}
          </span>
        )}
      </div>

      <div className="relative h-2.5 rounded-full bg-gray-100 overflow-hidden">
        {rows.map((row, index) => {
          const priorShare = rows.slice(0, index).reduce((sum, r) => sum + r.share, 0);
          return (
            <CapacitySegment
              key={row.counterpartyId}
              leftPct={(priorShare / targetPercent) * 100}
              widthPct={(row.share / targetPercent) * 100}
              color={colorMap[row.counterpartyId]}
              delayMs={index * 500}
              roundedLeft={index === 0}
              roundedRight={index === rows.length - 1}
            />
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        Available:{' '}
        <span className="text-[13px] font-bold text-gray-600">
          {Math.max(0, +(targetPercent - acceptedPercent).toFixed(4))}%
        </span>
      </p>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {rows.map((row) => (
            <div key={row.counterpartyId} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: colorMap[row.counterpartyId] }}
              />
              <span className="text-xs font-medium" style={{ color: colorMap[row.counterpartyId] }}>
                {row.reinsurerName}
                <span className="text-gray-400 font-normal"> · {row.share}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
