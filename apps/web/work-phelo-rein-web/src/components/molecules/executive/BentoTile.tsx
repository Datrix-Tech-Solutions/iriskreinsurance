'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cardClass, cn } from '@/lib/utils';
import { useThemeStore } from '@/store/theme.store';

interface BentoTileProps {
  color: string;
  /** Tinted with the module color to draw the eye — used for the tile(s) that need attention. */
  highlight?: boolean;
  className?: string;
  children: ReactNode;
}

/** A single stat tile inside a module overview card — plain surface by default, or tinted when `highlight`. */
export function BentoTile({ color, highlight, className, children }: BentoTileProps) {
  const isDark = useThemeStore((s) => s.theme === 'dark');

  const style: CSSProperties | undefined = highlight
    ? {
        backgroundColor: `color-mix(in oklch, ${color} ${isDark ? 28 : 10}%, ${isDark ? 'black' : 'white'})`,
      }
    : undefined;

  return (
    <div
      style={style}
      className={cardClass(cn('p-4 flex flex-col justify-center gap-1 min-w-0', className))}
    >
      {children}
    </div>
  );
}

export function TileLabel({
  children,
  highlight,
  color,
}: {
  children: ReactNode;
  highlight?: boolean;
  color: string;
}) {
  return (
    <p
      className={cn('text-xs font-medium truncate', !highlight && 'text-gray-500')}
      style={highlight ? { color } : undefined}
    >
      {children}
    </p>
  );
}

export function TileValue({
  value,
  total,
  highlight,
  color,
}: {
  value: ReactNode;
  total?: ReactNode;
  highlight?: boolean;
  color: string;
}) {
  return (
    <p
      className={cn('text-2xl font-bold leading-tight', !highlight && 'text-gray-900')}
      style={highlight ? { color } : undefined}
    >
      {value ?? '—'}
      {total !== undefined && (
        <span
          className={cn('text-base font-medium ml-1', highlight ? 'opacity-60' : 'text-gray-400')}
        >
          / {total}
        </span>
      )}
    </p>
  );
}
