'use client';

import { useMemo } from 'react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { cn } from '@/lib/utils';

interface YearSelectProps {
  value: number;
  onChange: (year: number) => void;
  /** Oldest year offered. Defaults to five years before `maxYear`. */
  minYear?: number;
  /** Newest year offered. Defaults to the current year. */
  maxYear?: number;
  className?: string;
}

/** Compact year picker shown next to a period toggle while "Yearly" is selected. */
export function YearSelect({
  value,
  onChange,
  minYear,
  maxYear = new Date().getFullYear(),
  className,
}: YearSelectProps) {
  const min = minYear ?? maxYear - 5;

  const options = useMemo(() => {
    const years: { value: string; label: string }[] = [];
    for (let y = maxYear; y >= min; y -= 1) years.push({ value: String(y), label: String(y) });
    return years;
  }, [min, maxYear]);

  return (
    <div className={cn('w-35', className)}>
      <SearchSelect
        placeholder="Year"
        options={options}
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        size="sm"
      />
    </div>
  );
}
