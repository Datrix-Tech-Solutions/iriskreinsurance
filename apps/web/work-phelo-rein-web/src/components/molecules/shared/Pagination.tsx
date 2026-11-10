'use client';

import { cn, cardClass } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  // Sliding window: first, last, and current ±1. Near the edges, widen the
  // window so the control keeps a stable width.
  let start = Math.max(2, current - 1);
  let end = Math.min(total - 1, current + 1);
  if (current <= 3) end = 4;
  if (current >= total - 2) start = total - 3;

  const pages: (number | '...')[] = [1];
  if (start > 2) pages.push('...');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('...');
  pages.push(total);
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
