'use client';

import { cn, cardClass } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1, 2, 3];

  const showCurrent = current > 3 && current < total - 1;
  if (showCurrent) {
    if (current > 4) pages.push('...');
    pages.push(current);
  }

  // Ellipsis whenever there's an actual gap before the last page — not just when
  // the current page happens to be past 4 (that left runs like [1, 2, 3, 20] with
  // no separator whenever you were viewing an early page of a long list).
  const lastShown = pages[pages.length - 1] as number;
  if (total - lastShown > 1) pages.push('...');

  if (!pages.includes(total)) pages.push(total);
  return pages;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className={cardClass('flex items-center justify-between px-4 py-2.5')}>
      {/* Left: prev + page numbers + next */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-(--module-btn-bg,var(--color-brand)) hover:text-(--module-btn-bg,var(--color-brand)) disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-600 transition-colors"
        >
          Previous
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'w-8 h-8 text-sm rounded-lg border transition-colors',
                p === currentPage
                  ? 'bg-(--module-btn-bg,var(--color-brand)) text-white font-medium border-(--module-btn-bg,var(--color-brand))'
                  : 'border-gray-200 text-gray-600 hover:border-(--module-btn-bg,var(--color-brand)) hover:text-(--module-btn-bg,var(--color-brand))',
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-(--module-btn-bg,var(--color-brand)) hover:text-(--module-btn-bg,var(--color-brand)) disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-600 transition-colors"
        >
          Next
        </button>
      </div>

      {/* Right: Page X of Y */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Page</span>
        <select
          value={currentPage}
          onChange={(e) => onPageChange(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span>of {totalPages}</span>
      </div>
    </div>
  );
}
