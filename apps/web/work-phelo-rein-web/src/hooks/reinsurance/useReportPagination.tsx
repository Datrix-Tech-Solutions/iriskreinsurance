import { useMemo, useState } from 'react';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS: (number | 'all')[] = [10, 20, 50, 100, 200, 'all'];

/**
 * Client-side pagination for the reinsurance report tables. Owns the current page and the
 * rows-per-page choice, slices the rows, and hands back a ready-made rows-per-page `<select>`
 * to drop into DataTable's `toolbarTrailing` slot (next to Export). The control only renders
 * once the result spills past the default page size.
 */
export function useReportPagination<T>(rows: T[]): {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  pagedRows: T[];
  rowsPerPageControl: React.ReactNode;
} {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(DEFAULT_PAGE_SIZE);

  const effectivePageSize = pageSize === 'all' ? Math.max(rows.length, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(rows.length / effectivePageSize));
  // Clamp so a shrunk result (fewer rows, or a larger page size) can't strand the view on
  // an out-of-range page.
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const pagedRows = useMemo(
    () => rows.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize),
    [rows, safePage, effectivePageSize],
  );

  const rowsPerPageControl =
    rows.length > DEFAULT_PAGE_SIZE ? (
      <label className="flex items-center gap-1.5 text-sm text-gray-500">
        Rows
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const v = e.target.value;
            setPageSize(v === 'all' ? 'all' : Number(v));
            setPage(1);
          }}
          className="appearance-none rounded-input border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-(--focus-ring,var(--color-gray-400))"
        >
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {opt === 'all' ? 'All' : opt}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  return { page: safePage, setPage, totalPages, pagedRows, rowsPerPageControl };
}
