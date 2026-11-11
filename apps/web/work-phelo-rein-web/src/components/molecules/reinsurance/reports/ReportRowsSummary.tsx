interface ReportRowsSummaryProps {
  page: number;
  pageSize: number;
  /** Rows currently on screen (the length of the page's data). */
  shown: number;
  /** Total rows across all pages for the applied filters. */
  total: number;
  isLoading?: boolean;
}

/** "21–22 of 32" — which slice of the filtered result set is on screen. */
export function ReportRowsSummary({
  page,
  pageSize,
  shown,
  total,
  isLoading,
}: ReportRowsSummaryProps) {
  const start = shown ? (page - 1) * pageSize + 1 : 0;
  const end = shown ? start + shown - 1 : 0;
  return (
    <span className="flex flex-col text-sm text-gray-500 tabular-nums" aria-live="polite">
      <span>{isLoading ? 'Loading…' : `${shown ? `${start}–${end}` : '0'} of ${total}`}</span>
      <span className="text-[10px] text-gray-400">Exports: all filtered rows · max 50,000</span>
    </span>
  );
}
