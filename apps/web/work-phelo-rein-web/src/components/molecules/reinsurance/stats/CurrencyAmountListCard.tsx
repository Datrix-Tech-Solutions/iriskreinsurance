'use client';

import { DataList, Column } from '@/components/organisms/shared/DataList';
import { Currency } from '@/types/reinsurance';
import { cn, transparentCardClass } from '@/lib/utils';

type AmountRow = Currency & { amount: number | null; subAmount: number | null };

function fmtAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

function buildColumns(label: string, subLabel?: string): Column<AmountRow>[] {
  return [
    {
      key: 'currency',
      label: 'Currency',
      width: '56px',
      render: (row) => <span className="font-medium text-gray-900">{row.isoCode}</span>,
    },
    {
      key: 'amount',
      label,
      width: '1fr',
      className: 'text-right',
      render: (row) => (
        <span className="flex flex-col items-end">
          <span className="block truncate font-medium text-gray-900">
            {row.amount != null ? fmtAmount(row.amount) : '—'}
          </span>
          {subLabel && (
            <span className="block truncate text-[11px] text-gray-400">
              {subLabel} {row.subAmount != null ? fmtAmount(row.subAmount) : '—'}
            </span>
          )}
        </span>
      ),
    },
  ];
}

interface CurrencyAmountListCardProps {
  title: string;
  columnLabel: string;
  amountsByCode: Map<string, number>;
  currencies: Currency[];
  isLoading?: boolean;
  emptyMessage?: string;
  /** Overrides the card's default height (`h-80`). */
  className?: string;
  /** Optional second amount, rendered as a caption under the main amount, keyed by ISO code. */
  subAmountsByCode?: Map<string, number>;
  /** Caption shown before the sub-amount (e.g. "Outstanding"). Required for the sub-line to render. */
  subLabel?: string;
}

export function CurrencyAmountListCard({
  title,
  columnLabel,
  amountsByCode,
  currencies,
  isLoading,
  emptyMessage = 'No data for this period',
  className,
  subAmountsByCode,
  subLabel,
}: CurrencyAmountListCardProps) {
  const rows = currencies
    .map((c) => ({
      ...c,
      amount: amountsByCode.get(c.isoCode) ?? null,
      subAmount: subAmountsByCode?.get(c.isoCode) ?? null,
    }))
    .filter((row) => row.amount != null);

  return (
    <div className={cn(transparentCardClass('flex flex-col gap-3 py-5 h-80'), className)}>
      <h3 className="text-sm font-semibold text-blue-900">{title}</h3>
      <div className="flex-1 min-h-0 overflow-y-auto -mx-3 px-3">
        <DataList
          columns={buildColumns(columnLabel, subLabel)}
          data={rows}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
        />
      </div>
    </div>
  );
}
