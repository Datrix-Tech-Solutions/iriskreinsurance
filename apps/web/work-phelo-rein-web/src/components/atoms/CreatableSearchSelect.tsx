'use client';

import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn, popupClass } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';
import { useDropdownPosition } from '@/hooks';

export interface CreatableOption {
  value: string;
  label: string;
}

interface CreatableSearchSelectProps {
  label?: string;
  placeholder?: string;
  /** Pre-existing options to suggest (can be empty) */
  options?: CreatableOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <Icons.ChevronDown className={cn('transition-transform duration-150', open && 'rotate-180')} />
  );
}

export function CreatableSearchSelect({
  label,
  placeholder = 'Type to search or create…',
  options = [],
  value = '',
  onChange,
  error,
}: CreatableSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listboxId = useId();
  const { pos: dropdownPos, updatePos: updateDropdownPos } = useDropdownPosition(
    open,
    containerRef,
  );

  /* Sync display value when closed */
  const inputDisplay = open ? query : value;

  /* close on outside click — dropdown is portaled to <body>, so it must be checked separately from containerRef */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      /* Commit whatever is typed when user clicks away */
      if (query.trim()) onChange?.(query.trim());
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [query, onChange]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const showCreate =
    query.trim().length > 0 &&
    !filtered.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  /* rows navigable by keyboard: filtered options, plus the "Create …" row when shown */
  const rowCount = filtered.length + (showCreate ? 1 : 0);

  /* keep the highlighted row in range as the filtered list / create row changes — adjusted
     during render (rather than an effect) per React's guidance for state that mirrors a derived value */
  const [prevRowKey, setPrevRowKey] = useState({ filtered, showCreate });
  if (prevRowKey.filtered !== filtered || prevRowKey.showCreate !== showCreate) {
    setPrevRowKey({ filtered, showCreate });
    setHighlightedIndex(rowCount > 0 ? 0 : -1);
  }

  /* scroll the highlighted row into view as it moves via keyboard */
  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  const selectRow = (index: number) => {
    if (index < filtered.length) handleSelect(filtered[index].value);
    else if (showCreate) handleCreate();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        handleFocus();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => (rowCount ? (i + 1) % rowCount : -1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => (rowCount ? (i - 1 + rowCount) % rowCount : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) selectRow(highlightedIndex);
        else if (showCreate) handleCreate();
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setQuery('');
        break;
      case 'Home':
        if (rowCount) {
          e.preventDefault();
          setHighlightedIndex(0);
        }
        break;
      case 'End':
        if (rowCount) {
          e.preventDefault();
          setHighlightedIndex(rowCount - 1);
        }
        break;
    }
  };

  const handleFocus = () => {
    updateDropdownPos();
    setOpen(true);
    setQuery(value); // pre-fill with current value so user can refine
  };

  const handleSelect = (val: string) => {
    onChange?.(val);
    setOpen(false);
    setQuery('');
  };

  const handleCreate = () => {
    const trimmed = query.trim();
    if (trimmed) handleSelect(trimmed);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
    setQuery('');
    setOpen(false);
  };

  const handleChevronClick = () => {
    if (open) {
      setOpen(false);
      setQuery('');
    } else {
      updateDropdownPos();
      setOpen(true);
      setQuery(value);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem) relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      <div
        className={cn(
          'flex items-center border rounded-input bg-white px-4 transition-colors',
          open ? 'border-brand ring-1 ring-brand/20' : error ? 'border-red-500' : 'border-gray-300',
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputDisplay}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
          }
          className="flex-1 py-3 text-sm bg-transparent focus:outline-none text-gray-900 placeholder:text-gray-400 min-w-0"
        />

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && !open && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-500 transition-colors p-0.5"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleChevronClick}
            className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
          >
            <ChevronDown open={open} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Portaled to <body> so the dropdown overlays in place instead of pushing the rest of the form down. */}
      {open &&
        (filtered.length > 0 || showCreate) &&
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
            }}
            className={popupClass('z-50 overflow-hidden')}
          >
            <div
              id={listboxId}
              role="listbox"
              className="overflow-y-auto py-1"
              style={{ maxHeight: Math.min(208, dropdownPos.maxHeight) }}
            >
              {filtered.map((opt, idx) => (
                <button
                  key={opt.value}
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={opt.value === value}
                  ref={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors',
                    opt.value === value
                      ? 'bg-brand-tint text-brand font-medium'
                      : cn(
                          'text-gray-900 hover:bg-gray-300',
                          idx === highlightedIndex && 'bg-gray-300',
                        ),
                  )}
                >
                  {opt.label}
                </button>
              ))}

              {showCreate && (
                <button
                  id={`${listboxId}-option-${filtered.length}`}
                  role="option"
                  aria-selected={false}
                  ref={(el) => {
                    optionRefs.current[filtered.length] = el;
                  }}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(filtered.length)}
                  onClick={handleCreate}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm text-brand transition-colors flex items-center gap-2 border-t border-gray-100 hover:bg-brand-tint',
                    highlightedIndex === filtered.length && 'bg-brand-tint',
                  )}
                >
                  <Icons.Plus className="w-4 h-4 shrink-0" />
                  <span>
                    Create <span className="font-medium">&ldquo;{query.trim()}&rdquo;</span>
                  </span>
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
