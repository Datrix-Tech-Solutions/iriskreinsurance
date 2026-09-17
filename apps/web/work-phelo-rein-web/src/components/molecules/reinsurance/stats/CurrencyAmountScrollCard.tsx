'use client';

import { Skeleton } from '@/components/atoms/Skeleton';
import { cardClass } from '@/lib/utils';

export interface CurrencyAmountRow {
  code: string;
  amount: number;
}

interface CurrencyAmountScrollCardProps {
  title: string;

  rows: CurrencyAmountRow[];
  isLoading?: boolean;
  emptyMessage?: string;
}

function fmtAmount(amount: number, code: string) {
  return `${code} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CurrencyAmountScrollCard({
  title,
  rows,
  isLoading,
  emptyMessage = 'No finalized claims yet',
}: CurrencyAmountScrollCardProps) {
  return (
    <div className={cardClass('flex flex-col gap-2 p-3', 'glass')}>
      <span className="text-xs font-bold text-gray-700">{title}</span>

      {isLoading ? (
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 shrink-0" />
          <Skeleton className="h-9 w-28 shrink-0" />
          <Skeleton className="h-9 w-28 shrink-0" />
        </div>
      ) : rows.length === 0 ? (
        <span className="text-sm text-gray-400">{emptyMessage}</span>
      ) : (
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {rows.map((row) => (
            <div key={row.code} className="shrink-0 min-w-32.5 rounded-lg px-2 py-1">
              <div className="text-[10px] font-medium text-gray-400">{row.code}</div>
              <div className="text-sm font-bold text-gray-900 whitespace-nowrap">
                {fmtAmount(row.amount, row.code)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
