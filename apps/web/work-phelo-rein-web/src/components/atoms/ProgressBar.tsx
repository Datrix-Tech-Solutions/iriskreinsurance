'use client';

import { useEffect, useState } from 'react';

interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  /** Fill color class, e.g. 'bg-brand' (default), 'bg-green-500', 'bg-red-500'. */
  fillClassName?: string;
}

export function ProgressBar({
  value,
  showLabel = true,
  fillClassName = 'bg-brand',
}: ProgressBarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${fillClassName}`}
          style={{ width: mounted ? `${clamped}%` : '0%' }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-bold text-gray-900 w-10 text-right">{clamped}%</span>
      )}
    </div>
  );
}
