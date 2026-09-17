'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn, popupClass } from '@/lib/utils';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useDropdownPosition } from '@/hooks';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Use a leap year so Feb has 29 days
const GRID_YEAR = 2000;

interface MonthDayPickerProps {
  label?: string;
  value?: string; // MM-DD format (or legacy YYYY-MM-DD)
  onChange?: (value: string) => void; // always emits MM-DD
  error?: string;
  placeholder?: string;
}

function parseMonthDay(v: string | undefined): { month: number; day: number } | null {
  if (!v) return null;
  if (v.length === 5 && v[2] === '-') {
    return { month: parseInt(v.slice(0, 2), 10) - 1, day: parseInt(v.slice(3), 10) };
  }
  if (v.length === 10) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return { month: d.getMonth(), day: d.getDate() };
  }
  return null;
}

export function MonthDayPicker({
  label,
  value,
  onChange,
  error,
  placeholder = 'DD/MM',
}: MonthDayPickerProps) {
  const parsed = parseMonthDay(value);
  const today = new Date();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'days' | 'months'>('days');
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const [prevValue, setPrevValue] = useState(value);

  if (prevValue !== value) {
    setPrevValue(value);
    if (parsed) setViewMonth(parsed.month);
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { pos: dropdownPos } = useDropdownPosition(open, containerRef);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setView('days');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayValue = parsed
    ? `${String(parsed.day).padStart(2, '0')}/${String(parsed.month + 1).padStart(2, '0')}`
    : '';

  const selectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange?.(`${mm}-${dd}`);
    setOpen(false);
    setView('days');
  };

  const prevMonth = () => setViewMonth((m) => (m === 0 ? 11 : m - 1));
  const nextMonth = () => setViewMonth((m) => (m === 11 ? 0 : m + 1));

  const firstDay = new Date(GRID_YEAR, viewMonth, 1).getDay();
  const daysInMonth = new Date(GRID_YEAR, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem) relative" ref={containerRef}>
      {label && (
        <label className="block truncate text-sm font-bold text-gray-900" title={label}>
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setView('days');
        }}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 border rounded-input bg-white text-sm transition-colors',
          error ? 'border-red-500' : 'border-gray-300',
          displayValue ? 'text-gray-900' : 'text-gray-400',
        )}
      >
        <span>{displayValue || placeholder}</span>
        <Calendar className="w-5 h-5 text-gray-400" />
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Portaled to <body> so the dropdown overlays in place instead of pushing the rest of the form down. */}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              bottom: dropdownPos.bottom,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: dropdownPos.maxHeight,
            }}
            className={popupClass('z-50 overflow-auto')}
          >
            {view === 'days' && (
              <>
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <button
                    onClick={() => setView('months')}
                    className="flex items-center gap-1.5 text-sm font-bold text-brand hover:opacity-70 transition-opacity"
                  >
                    {MONTHS[viewMonth]}
                    <ChevronDown className="w-4 h-4" />
                  </button>
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

                <div className="grid grid-cols-7 text-xs text-gray-500 py-2 px-3 border-b">
                  {DAYS.map((d) => (
                    <div key={d} className="text-center font-medium">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 p-3">
                  {cells.map((day, i) => {
                    if (!day) return <div key={i} className="h-9" />;
                    const isSelected = parsed && parsed.day === day && parsed.month === viewMonth;
                    return (
                      <button
                        key={i}
                        onClick={() => selectDay(day)}
                        className={cn(
                          'h-9 w-full text-sm rounded-lg transition-all',
                          isSelected
                            ? 'bg-brand text-white font-semibold shadow-sm'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {view === 'months' && (
              <>
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
                  <button
                    onClick={() => setView('days')}
                    className="flex items-center gap-1.5 text-sm font-bold text-brand hover:opacity-70 transition-opacity"
                  >
                    {MONTHS[viewMonth]}
                    <ChevronDown className="w-4 h-4 rotate-180" />
                  </button>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-3 gap-1">
                    {MONTHS.map((month, idx) => (
                      <button
                        key={month}
                        onClick={() => {
                          setViewMonth(idx);
                          setView('days');
                        }}
                        className={cn(
                          'py-2 text-sm rounded-lg transition-colors font-medium',
                          idx === viewMonth
                            ? 'bg-brand text-white'
                            : 'hover:bg-gray-100 text-gray-700',
                        )}
                      >
                        {month}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
