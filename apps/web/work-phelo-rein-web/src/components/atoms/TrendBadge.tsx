'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

interface TrendBadgeProps {
  change: number;
  tooltip?: string;
}

export function TrendBadge({ change, tooltip }: TrendBadgeProps) {
  const [show, setShow] = useState(false);
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <span className="relative inline-flex">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 text-[10px] font-medium px-1 py-0.05 rounded-full border',
          isNeutral && 'border-gray-300 text-gray-500',
          !isNeutral && isPositive && 'border-green-500 text-green-600',
          !isNeutral && !isPositive && 'border-red-400 text-red-500',
          tooltip && 'cursor-default',
        )}
        onMouseEnter={() => tooltip && setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {!isNeutral &&
          (isPositive ? (
            <Icons.TrendingUp className="w-3 h-3" />
          ) : (
            <Icons.TrendingDown className="w-3 h-3" />
          ))}
        {isNeutral ? '—' : `${Math.abs(change).toFixed(1)}%`}
      </span>

      {show && tooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none">
          <span className="block bg-(--chip-dark,#111827) text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
            {tooltip}
          </span>
          <span className="block w-2 h-2 bg-(--chip-dark,#111827) rotate-45 rounded-sm mx-auto -mt-1" />
        </span>
      )}
    </span>
  );
}
