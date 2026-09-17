'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn, popupClass } from '@/lib/utils';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useDropdownPosition } from '@/hooks';
import { Calendar } from '@/components/atoms/Calendar';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DatePickerProps {
  label?: string;
  value?: string; // ISO: YYYY-MM-DD
  onChange?: (value: string) => void;
  error?: string;
  placeholder?: string;
  disableFuture?: boolean;
  disablePast?: boolean;
  minDate?: string; // ISO: YYYY-MM-DD — disables all days before this date
  maxDate?: string; // ISO: YYYY-MM-DD — disables all days after this date
  /** 'md' (default) keeps the standard px-4 py-3 sizing; 'sm' matches FormField/SearchSelect's compact px-2 py-2 sizing. */
  size?: 'sm' | 'md';
  /** Rendered inside the trigger's own box, next to the calendar icon (e.g. a visibility
   *  toggle). The trigger itself is a <button>, so pass non-<button> interactive content
   *  here (e.g. a role="button" span) and stopPropagation on its click/keydown. */
  rightSlot?: React.ReactNode;
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  placeholder = 'DD/MM/YYYY',
  disableFuture = false,
  disablePast = false,
  minDate,
  maxDate,
  size = 'sm',
  rightSlot,
}: DatePickerProps) {
  const today = new Date();
  const parsed = value ? new Date(value) : null;

  const [open, setOpen] = useState(false);
  /* keeps the dropdown mounted through its closing transition — see showDropdown/expanded below */
  const [showDropdown, setShowDropdown] = useState(false);
  /* drives the actual grid-rows/opacity styles, one frame behind `open` on the
     way in — mounting already-expanded gives the browser nothing to transition
     from, so it just pops in instead of animating */
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());
  const [yearPageStart, setYearPageStart] = useState(() => {
    const y = parsed?.getFullYear() ?? today.getFullYear();
    return Math.floor(y / 9) * 9;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { pos: dropdownPos } = useDropdownPosition(open, containerRef);

  useEffect(() => {
    if (!showDropdown || !open) return;
    const raf = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(raf);
  }, [showDropdown, open]);

  const openDropdown = () => {
    setOpen(true);
    setShowDropdown(true);
    setView('days');
  };

  const closeDropdown = () => {
    setOpen(false);
    setExpanded(false);
  };

  /* keep the dropdown mounted until its closing transition finishes */
  const handleDropdownTransitionEnd = (e: React.TransitionEvent) => {
    if (!open && e.propertyName === 'grid-template-rows') setShowDropdown(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      closeDropdown();
      setView('days');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayValue = parsed
    ? `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`
    : '';

  const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const minDateNorm = minDate
    ? (() => {
        const d = new Date(minDate);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      })()
    : null;
  const maxDateNorm = maxDate
    ? (() => {
        const d = new Date(maxDate);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      })()
    : null;

  // A month is disabled if no selectable day exists within it
  const isDisabledMonth = (monthIdx: number) => {
    const firstDay = new Date(viewYear, monthIdx, 1);
    const lastDay = new Date(viewYear, monthIdx + 1, 0);
    if (disableFuture && firstDay > todayNorm) return true;
    if (disablePast && lastDay < todayNorm) return true;
    if (minDateNorm && lastDay < minDateNorm) return true;
    if (maxDateNorm && firstDay > maxDateNorm) return true;
    return false;
  };

  // A year is disabled if no selectable day exists within it
  const isDisabledYear = (year: number) => {
    const firstDay = new Date(year, 0, 1);
    const lastDay = new Date(year, 11, 31);
    if (disableFuture && firstDay > todayNorm) return true;
    if (disablePast && lastDay < todayNorm) return true;
    if (minDateNorm && lastDay < minDateNorm) return true;
    if (maxDateNorm && firstDay > maxDateNorm) return true;
    return false;
  };

  const selectDay = (iso: string) => {
    onChange?.(iso);
    closeDropdown();
    setView('days');
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const yearGrid = Array.from({ length: 9 }, (_, i) => yearPageStart + i);

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem) relative" ref={containerRef}>
      {label && (
        <label className="block truncate text-sm font-bold text-gray-900" title={label}>
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => (open ? closeDropdown() : openDropdown())}
        className={cn(
          'w-full flex items-center justify-between border rounded-input text-sm transition-colors',
          size === 'sm' ? 'px-2 py-2' : 'px-4 py-3',
          open
            ? 'bg-transparent border-(--module-btn-bg,var(--color-brand)) ring-2 ring-(--module-btn-bg,var(--color-brand))/30'
            : error
              ? 'bg-transparent border-red-500'
              : 'bg-transparent border-(--input-border,var(--color-gray-400))',
          displayValue ? 'text-gray-900' : 'text-gray-400',
        )}
      >
        <span>{displayValue || placeholder}</span>
        <span className="flex items-center gap-1.5">
          {rightSlot}
          <CalendarIcon className={cn('text-gray-400', size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />
        </span>
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {showDropdown &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            onTransitionEnd={handleDropdownTransitionEnd}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              bottom: dropdownPos.bottom,
              left: dropdownPos.left,
              width: dropdownPos.width,
              gridTemplateRows: expanded ? '1fr' : '0fr',
              opacity: expanded ? 1 : 0,
            }}
            className="z-50 grid transition-[grid-template-rows,opacity] duration-700 ease-in-out"
          >
            <div className={popupClass('min-h-0 overflow-hidden')}>
              <div className="overflow-y-auto" style={{ maxHeight: dropdownPos.maxHeight }}>
                {/* ── Days view ── */}
                {view === 'days' && (
                  <>
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setView('months')}
                          className="flex items-center gap-1 text-sm font-bold text-brand hover:opacity-70 transition-opacity px-1 py-1 rounded-lg hover:bg-gray-100"
                        >
                          {MONTHS[viewMonth]}
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setYearPageStart(Math.floor(viewYear / 9) * 9);
                            setView('years');
                          }}
                          className="flex items-center gap-1 text-sm font-bold text-brand hover:opacity-70 transition-opacity px-1 py-1 rounded-lg hover:bg-gray-100"
                        >
                          {viewYear}
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={prevMonth}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={nextMonth}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <Calendar
                      viewYear={viewYear}
                      viewMonth={viewMonth}
                      value={value}
                      onSelectDay={selectDay}
                      disableFuture={disableFuture}
                      disablePast={disablePast}
                      minDate={minDate}
                      maxDate={maxDate}
                    />
                  </>
                )}

                {/* ── Months view ── */}
                {view === 'months' && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setView('days')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="text-sm font-bold text-brand">{viewYear}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {MONTHS.map((month, idx) => {
                        const disabled = isDisabledMonth(idx);
                        return (
                          <button
                            key={month}
                            onClick={() => {
                              if (disabled) return;
                              setViewMonth(idx);
                              setView('days');
                            }}
                            disabled={disabled}
                            className={cn(
                              'py-3 text-sm rounded-lg transition-colors font-medium',
                              disabled
                                ? 'text-gray-400 cursor-not-allowed'
                                : idx === viewMonth
                                  ? 'bg-brand text-white'
                                  : 'text-gray-700 hover:bg-gray-100',
                            )}
                          >
                            {month}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Years view ── */}
                {view === 'years' && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setYearPageStart((s) => s - 9)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="text-sm font-bold text-brand">
                        {yearPageStart} – {yearPageStart + 8}
                      </span>
                      <button
                        onClick={() => setYearPageStart((s) => s + 9)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {yearGrid.map((year) => {
                        const disabled = isDisabledYear(year);
                        return (
                          <button
                            key={year}
                            onClick={() => {
                              if (disabled) return;
                              setViewYear(year);
                              setView('days');
                            }}
                            disabled={disabled}
                            className={cn(
                              'py-3 text-sm rounded-lg transition-colors font-medium',
                              disabled
                                ? 'text-gray-400 cursor-not-allowed'
                                : year === viewYear
                                  ? 'bg-brand text-white'
                                  : 'text-gray-700 hover:bg-gray-100',
                            )}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
