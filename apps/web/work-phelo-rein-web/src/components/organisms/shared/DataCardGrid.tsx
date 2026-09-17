'use client';

import { cn, cardClass, inputClass } from '@/lib/utils';
import { Pagination } from '@/components/molecules/shared/Pagination';
import { SearchIcon } from 'lucide-react';
import { NoSearchLogo } from '@/components/atoms/NoSearchLogo';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';

interface DataCardGridProps<T extends { id: string | number }> {
  data: T[];
  renderCard: (item: T) => React.ReactNode;
  isLoading?: boolean;
  /** Number of skeleton placeholders shown while loading. Defaults to 6. */
  skeletonCount?: number;
  /** Override the default skeleton shape. Called skeletonCount times. */
  renderSkeleton?: () => React.ReactNode;
  emptyMessage?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (q: string) => void;
  filterOptions?: { value: string; label: string }[];
  onFilter?: (value: string) => void;
  onExport?: () => void;
  extraFilters?: React.ReactNode;
  secondaryButton?: { label: string; onClick: () => void; badgeCount?: number };
  secondaryButtons?: { label: string; onClick: () => void; badgeCount?: number }[];
  actionButton?: { label: string; onClick: () => void };
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function DefaultSkeleton() {
  return <div className="w-72 h-40 rounded-2xl bg-gray-200 animate-pulse" />;
}

export function DataCardGrid<T extends { id: string | number }>({
  data,
  renderCard,
  isLoading,
  skeletonCount = 6,
  renderSkeleton,
  emptyMessage = 'No items found',
  searchPlaceholder = 'Search...',
  searchValue,
  onSearch,
  filterOptions,
  onFilter,
  onExport,
  extraFilters,
  secondaryButton,
  secondaryButtons,
  actionButton,
  currentPage,
  totalPages,
  onPageChange,
}: DataCardGridProps<T>) {
  const hasToolbar = !!(
    onSearch ||
    extraFilters ||
    (filterOptions && onFilter) ||
    onExport ||
    secondaryButton ||
    (secondaryButtons && secondaryButtons.length > 0) ||
    actionButton
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      {hasToolbar && (
        <div className={cardClass('flex items-center gap-3 flex-wrap shrink-0 px-4 py-2')}>
          {onSearch && (
            <div className="relative flex-1 min-w-52 max-w-sm">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue ?? undefined}
                onChange={(e) => onSearch(e.target.value)}
                className={inputClass(undefined, 'pl-9 pr-4 py-2')}
              />
            </div>
          )}

          {extraFilters}

          {filterOptions && onFilter && (
            <div className="relative">
              <select
                onChange={(e) => onFilter(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 border border-gray-200 rounded-input text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
              >
                <option value="">Status</option>
                {filterOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Icons.ListFilter className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none h-4 w-4" />
            </div>
          )}

          <div className="flex-1" />

          {onExport && (
            <Button variant="secondary" size="sm" onClick={onExport} className="group">
              Export
              <span className="inline-flex overflow-hidden w-0 group-hover:w-4 group-hover:ml-1.5 transition-[width,margin] duration-300 ease-out">
                <Icons.Upload className="w-4 h-4 shrink-0 -translate-x-4 group-hover:translate-x-0 transition-transform duration-300 ease-out" />
              </span>
            </Button>
          )}

          {secondaryButton && (
            <Button variant="secondary" size="sm" onClick={secondaryButton.onClick}>
              {secondaryButton.label}
              {(secondaryButton.badgeCount ?? 0) > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                  {secondaryButton.badgeCount}
                </span>
              )}
            </Button>
          )}

          {secondaryButtons?.map((btn, i) => (
            <Button key={i} variant="secondary" size="sm" onClick={btn.onClick}>
              {btn.label}
              {(btn.badgeCount ?? 0) > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                  {btn.badgeCount}
                </span>
              )}
            </Button>
          ))}

          {actionButton && (
            <Button size="sm" onClick={actionButton.onClick} className="group">
              {actionButton.label}
              <span className="inline-flex overflow-hidden w-0 group-hover:w-4 group-hover:ml-1.5 transition-[width,margin] duration-300 ease-out">
                <Icons.Plus className="w-4 h-4 shrink-0 -translate-x-4 group-hover:translate-x-0 transition-transform duration-300 ease-out" />
              </span>
            </Button>
          )}
        </div>
      )}

      {/* Card grid */}
      {isLoading ? (
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i}>{renderSkeleton ? renderSkeleton() : <DefaultSkeleton />}</div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
          <NoSearchLogo className="w-25 h-25" />
          <div>
            <p className="text-base font-medium text-gray-600 mb-1">{emptyMessage}</p>
            {emptyMessage.toLowerCase().includes('found') && (
              <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
            )}
          </div>
        </div>
      ) : (
        <div className={cn('flex flex-wrap gap-4')}>
          {data.map((item) => (
            <div key={item.id}>{renderCard(item)}</div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages >= 1 && (
        <div className="shrink-0">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
