'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, popupClass } from '@/lib/utils';
import { useDropdownPosition } from '@/hooks';

interface MonthPickerProps {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  disablePast?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function MonthPicker({
  label,
  value,
  onChange,
  placeholder = 'Select month',
  className,
  disabled = false,
  disablePast = false,
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  /* keeps the dropdown mounted through its closing transition — see showDropdown/expanded below */
  const [showDropdown, setShowDropdown] = useState(false);
  /* drives the actual grid-rows/opacity styles, one frame behind `isOpen` on the
     way in — mounting already-expanded gives the browser nothing to transition
     from, so it just pops in instead of animating */
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { pos: dropdownPos } = useDropdownPosition(isOpen, containerRef);
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  useEffect(() => {
    if (!showDropdown || !isOpen) return;
    const raf = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(raf);
  }, [showDropdown, isOpen]);

  const openDropdown = () => {
    setIsOpen(true);
    setShowDropdown(true);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setExpanded(false);
  };

  /* keep the dropdown mounted until its closing transition finishes */
  const handleDropdownTransitionEnd = (e: React.TransitionEvent) => {
    if (!isOpen && e.propertyName === 'grid-template-rows') setShowDropdown(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      closeDropdown();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Normalise to YYYY-MM — backend may return a full date string (YYYY-MM-DD or ISO)
  const normalizedValue = value ? value.substring(0, 7) : undefined;

  const [viewYear, setViewYear] = useState(
    normalizedValue ? parseInt(normalizedValue.split('-')[0]) : currentYear,
  );

  const selectedDate = normalizedValue ? new Date(normalizedValue + '-01') : null;

  // Generate months for the current viewed year
  const months = Array.from({ length: 12 }, (_, i) => {
    const monthValue = `${viewYear}-${String(i + 1).padStart(2, '0')}`;
    const isPast =
      disablePast && (viewYear < currentYear || (viewYear === currentYear && i < currentMonth));

    return {
      month: i,
      name: MONTH_NAMES[i],
      value: monthValue,
      isPast,
    };
  });

  const handleSelect = (monthValue: string) => {
    onChange(monthValue);
    closeDropdown();
  };

  const goToPrevYear = () => setViewYear((y) => y - 1);
  const goToNextYear = () => setViewYear((y) => y + 1);

  const displayText =
    selectedDate && !isNaN(selectedDate.getTime())
      ? `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
      : placeholder;

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {label && (
        <label
          className="block truncate text-sm font-bold text-gray-900 mb-(--field-label-gap,0.125rem)"
          title={label}
        >
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          if (isOpen) closeDropdown();
          else openDropdown();
        }}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between px-2 py-2 border rounded-input bg-transparent text-left text-sm transition-colors',
          'focus:outline-none',
          isOpen
            ? 'border-(--module-btn-bg,var(--color-brand)) ring-2 ring-(--module-btn-bg,var(--color-brand))/30'
            : 'border-(--input-border,var(--color-gray-400))',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <span className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>{displayText}</span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </button>

      {/* Portaled to <body> so the dropdown overlays in place instead of pushing the rest of the form down. */}
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
              <div
                className="overflow-y-auto py-4 px-4"
                style={{ maxHeight: dropdownPos.maxHeight }}
              >
                {/* Year Header */}
                <div className="flex items-center justify-between mb-4 px-2">
                  <button
                    onClick={goToPrevYear}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="font-semibold text-gray-900">{viewYear}</span>
                  <button
                    onClick={goToNextYear}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Months Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {months.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => !m.isPast && handleSelect(m.value)}
                      disabled={m.isPast}
                      className={cn(
                        'py-3 px-4 text-sm rounded-xl transition-all',
                        m.isPast && 'opacity-40 cursor-not-allowed',
                        normalizedValue === m.value
                          ? 'bg-brand text-white font-medium'
                          : !m.isPast && 'hover:bg-gray-100 text-gray-700',
                      )}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>

                {/* Quick "3 Months from now" button */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      const now = new Date();
                      const future = new Date(now.getFullYear(), now.getMonth() + 3, 1);
                      const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}`;
                      onChange(futureStr);
                      closeDropdown();
                    }}
                    className="w-full py-2.5 text-sm text-brand hover:bg-brand/5 rounded-xl transition-colors"
                  >
                    Set to 3 months from now
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
