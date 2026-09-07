'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn, cardClass, inputClass, popupClass } from '@/lib/utils';
import { Pagination } from '@/components/molecules/shared/Pagination';
import { SearchIcon } from 'lucide-react';
import { NoSearchLogo } from '../../atoms/NoSearchLogo';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

export interface RowAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Additional color options beyond the default/danger split. */
  variant?: 'success';
}

interface DataTableProps<T extends { id: string | number }> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyImage?: React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (q: string) => void;
  filterOptions?: { value: string; label: string }[];
  onFilter?: (value: string) => void;
  onExport?: () => void;
  extraFilters?: React.ReactNode;
  /** Render extraFilters before the search input instead of after (default order is search, then extraFilters). */
  searchAfterFilters?: boolean;
  secondaryButton?: {
    color?: string;
    label: string;
    onClick: () => void;
    badgeCount?: number;
    icon?: React.ReactNode;
  };
  secondaryButtons?: {
    label: string;
    onClick: () => void;
    badgeCount?: number;
    className?: string;
    disabled?: boolean;
    title?: string;
  }[];
  actionButton?: { label: string; onClick: () => void; disabled?: boolean };
  rowActions?: (row: T) => RowAction[];
  /** When a row has exactly one action, it renders as a standalone inline button by default.
   *  Set false to always render the ⋯ menu instead, even for a single action. */
  singleActionAsButton?: boolean;
  onRowClick?: (row: T) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  noInternalScroll?: boolean;
}

function ThreeDotMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  /* keeps the dropdown mounted through its closing transition — see expanded below */
  const [showDropdown, setShowDropdown] = useState(false);
  /* drives the actual grid-rows/opacity styles, one frame behind `open` on the
     way in — mounting already-expanded gives the browser nothing to transition
     from, so it just pops in instead of animating */
  const [expanded, setExpanded] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, bottom: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showDropdown || !open) return;
    const raf = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(raf);
  }, [showDropdown, open]);

  const closeDropdown = () => {
    setOpen(false);
    setExpanded(false);
  };

  /* keep the dropdown mounted until its closing transition finishes */
  const handleDropdownTransitionEnd = (e: React.TransitionEvent) => {
    if (!open && e.propertyName === 'grid-template-rows') setShowDropdown(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      closeDropdown();
      return;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setOpenUpward(window.innerHeight - rect.bottom < 200);
      setMenuPos({
        top: rect.bottom + 4,
        bottom: window.innerHeight - rect.top + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(true);
    setShowDropdown(true);
  };

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="pl-5 p-1.5 rounded-lg text-gray-400 hover:text-(--text-hover-muted,var(--color-gray-900)) hover:[&>svg]:stroke-[4.5] transition-colors"
      >
        <Icons.EllipsisVertical />
      </button>

      {showDropdown &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                closeDropdown();
              }}
            />
            <div
              onTransitionEnd={handleDropdownTransitionEnd}
              style={{
                position: 'fixed',
                right: menuPos.right,
                ...(openUpward ? { bottom: menuPos.bottom } : { top: menuPos.top }),
                width: 176,
                gridTemplateRows: expanded ? '1fr' : '0fr',
                opacity: expanded ? 1 : 0,
              }}
              className="z-50 grid transition-[grid-template-rows,opacity] duration-700 ease-in-out"
            >
              <div className={popupClass('min-h-0 overflow-hidden')}>
                <div className="py-1">
                  {actions.map((action) => (
                    <button
                      key={action.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                        closeDropdown();
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-sm hover:bg-(--surface-hover-subtle,var(--color-gray-50)) transition-colors',
                        action.danger
                          ? 'text-red-600'
                          : action.variant === 'success'
                            ? 'text-blue-600'
                            : 'text-gray-700',
                      )}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  isLoading,
  emptyMessage = 'No items found',
  emptyImage,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearch,
  filterOptions,
  onFilter,
  onExport,
  extraFilters,
  searchAfterFilters = false,
  secondaryButton,
  secondaryButtons,
  actionButton,
  rowActions,
  singleActionAsButton = true,
  onRowClick,
  currentPage,
  totalPages,
  onPageChange,
  noInternalScroll = false,
}: DataTableProps<T>) {
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
    <div className={cn('flex flex-col gap-3', noInternalScroll ? '' : 'flex-1 min-h-0 h-full')}>
      {/* Toolbar card */}
      {hasToolbar && (
        <div className={cardClass('px-4 py-2 shrink-0')}>
          <div className="flex items-center gap-3 flex-wrap">
            {!searchAfterFilters && onSearch && (
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

            {searchAfterFilters && onSearch && (
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

            {filterOptions && onFilter && (
              <div className="relative">
                <select
                  onChange={(e) => onFilter(e.target.value)}
                  className="appearance-none pl-8 pr-8 py-2 border border-gray-200 rounded-input text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-(--focus-ring,var(--color-gray-400)) bg-white"
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
              <Button
                variant="secondary"
                size="sm"
                onClick={secondaryButton.onClick}
                icon={secondaryButton.icon}
              >
                {secondaryButton.label}
                {(secondaryButton.badgeCount ?? 0) > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                    {secondaryButton.badgeCount}
                  </span>
                )}
              </Button>
            )}
            {secondaryButtons?.map((btn, i) => (
              <Button
                key={i}
                variant="secondary"
                size="sm"
                onClick={btn.onClick}
                className={btn.className}
                disabled={btn.disabled}
                title={btn.title}
              >
                {btn.label}
                {(btn.badgeCount ?? 0) > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                    {btn.badgeCount}
                  </span>
                )}
              </Button>
            ))}

            {actionButton && (
              <Button
                size="sm"
                onClick={actionButton.onClick}
                disabled={actionButton.disabled}
                className="group"
              >
                {actionButton.label}
                <span className="inline-flex overflow-hidden w-0 group-hover:w-4 group-hover:ml-1.5 transition-[width,margin] duration-300 ease-out">
                  <Icons.Plus className="w-4 h-4 shrink-0 -translate-x-4 group-hover:translate-x-0 transition-transform duration-300 ease-out" />
                </span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table card — header + rows only */}
      <div
        className={cardClass(
          cn('overflow-hidden flex flex-col pt-3', noInternalScroll ? '' : 'flex-1 min-h-0'),
        )}
      >
        {/* Horizontal scroll wrapper — keeps header and rows in sync */}
        <div className="overflow-x-auto flex-1 min-h-0 flex flex-col">
          <div className="min-w-full flex flex-col flex-1 min-h-0">
            {/* Header */}
            <div className="relative shrink-0 w-fit min-w-full">
              <div
                className={cardClass(
                  cn(
                    'absolute inset-y-0 left-4 right-4 bg-(--table-header-bg,var(--color-gray-200)) rounded-lg',
                    'drop-shadow-[0_4px_6px_var(--table-header-shadow,transparent)]',
                  ),
                  'glass',
                )}
              />
              <div
                className="relative grid gap-x-4 text-xs font-semibold text-(--table-header-text,var(--module-btn-bg,var(--color-brand))) uppercase tracking-wide px-6 py-3"
                style={{
                  gridTemplateColumns: [
                    ...columns.map((c) => c.width ?? '1fr'),
                    ...(rowActions ? ['44px'] : []),
                  ].join(' '),
                }}
              >
                {columns.map((col) => (
                  <div key={col.key} className={cn('min-w-0', col.className)}>
                    {col.label}
                  </div>
                ))}
                {rowActions && <span />}
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div
              className={noInternalScroll ? '' : 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden'}
            >
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative w-8 h-8">
                      <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-brand animate-spin" />
                      <div className="absolute inset-1.5 rounded-full border-3 border-transparent border-b-brand-accent animate-[spin_.6s_linear_infinite_reverse]" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Loading...</p>
                  </div>
                </div>
              ) : data.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  <div className="flex flex-col items-center gap-5 text-center px-6">
                    {emptyImage ?? (
                      <div className="w-28 h-28 rounded-3xl flex items-center justify-center">
                        <NoSearchLogo className="w-25 h-25" />
                      </div>
                    )}
                    <div>
                      <p className="text-base font-medium text-gray-600 mb-1">{emptyMessage}</p>
                      {emptyMessage.toLowerCase().includes('found') && (
                        <p className="text-sm text-gray-400">
                          Try adjusting your search or filters
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                data.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'relative group/row w-fit min-w-full border-b border-gray-100 last:border-b-0',
                      onRowClick && 'cursor-pointer',
                    )}
                  >
                    <div
                      className={cardClass(
                        cn(
                          'absolute inset-y-0.5 left-4 right-4 rounded-lg bg-(--table-header-bg,var(--color-gray-200)) opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 pointer-events-none',
                          'drop-shadow-[0_2px_3px_var(--table-header-shadow,transparent)]',
                        ),
                        'glass',
                      )}
                    />
                    <div
                      className="relative grid gap-x-4 px-6 py-3 items-center text-sm text-gray-800"
                      style={{
                        gridTemplateColumns: [
                          ...columns.map((c) => c.width ?? '1fr'),
                          ...(rowActions ? ['44px'] : []),
                        ].join(' '),
                      }}
                    >
                      {columns.map((col) => (
                        <div key={col.key} className={cn('min-w-0', col.className)}>
                          {col.render
                            ? col.render(row)
                            : String((row as Record<string, unknown>)[col.key] ?? '')}
                        </div>
                      ))}
                      {rowActions &&
                        (() => {
                          const actions = rowActions(row);
                          if (actions.length === 0) return null;
                          if (actions.length === 1 && singleActionAsButton) {
                            const action = actions[0];
                            return (
                              <div className="flex justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick();
                                  }}
                                  className={cn(
                                    'text-sm font-medium px-2 py-1 rounded-lg transition-colors',
                                    action.danger
                                      ? 'text-red-600 hover:bg-red-50'
                                      : action.variant === 'success'
                                        ? 'text-blue-600 hover:bg-blue-50'
                                        : 'text-brand hover:bg-brand/5',
                                  )}
                                >
                                  {action.label}
                                </button>
                              </div>
                            );
                          }
                          return (
                            <div className="flex justify-end w-4">
                              <ThreeDotMenu actions={actions} />
                            </div>
                          );
                        })()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pagination — outside the card */}
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
