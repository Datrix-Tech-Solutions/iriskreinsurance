'use client';

import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn, popupClass } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';
import { useDropdownPosition } from '@/hooks';

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

/** Sentinel for the synthetic "All" row in inline (filter-bar) mode — real option values never use it. */
const ALL_VALUE = '';

interface MultiSelectProps {
  label?: string;
  placeholder?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  error?: string;
  hideChips?: boolean;
  /** 'md' (default) keeps the standard py-3 height; 'sm' matches the DataTable search input (py-2). */
  size?: 'sm' | 'md';
  /** 'default' shows selected values as removable chips above the field. 'inline' (for filter bars)
   *  keeps everything to a single row — no chips above, selections summarized inside the field itself. */
  variant?: 'default' | 'inline';
  /** Label for the inline variant's "All" row/empty state. Defaults to "All {placeholder}"
   *  (e.g. "All Status") so the field names its own dimension rather than showing a bare "All". */
  allLabel?: string;
  /** Fires on every keystroke so callers can use bounded server-side option searches. */
  onQueryChange?: (query: string) => void;
}

export function MultiSelect({
  label,
  placeholder = 'Select…',
  options,
  value,
  onChange,
  error,
  hideChips = false,
  size = 'sm',
  variant = 'default',
  allLabel,
  onQueryChange,
}: MultiSelectProps) {
  const resolvedAllLabel = allLabel ?? `All ${placeholder}`;
  const [open, setOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  /* drives the actual grid-rows/opacity styles, one frame behind `open` on the
     way in — mounting already-expanded gives the browser nothing to transition
     from, so it just pops in instead of animating */
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listboxId = useId();
  const { pos: dropdownPos, updatePos: updateDropdownPos } = useDropdownPosition(open, triggerRef);

  useEffect(() => {
    if (!showDropdown || !open) return;
    const raf = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(raf);
  }, [showDropdown, open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  const openDropdown = () => {
    updateDropdownPos();
    setOpen(true);
    setShowDropdown(true);
  };

  const closeDropdown = () => {
    setOpen(false);
    setExpanded(false);
  };

  /* keep the dropdown mounted until its closing transition finishes */
  const handleDropdownTransitionEnd = (e: React.TransitionEvent) => {
    if (!open && e.propertyName === 'grid-template-rows') setShowDropdown(false);
  };

  /* close on outside click — dropdown is portaled to <body>, so it must be checked separately from containerRef */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      closeDropdown();
      setQuery('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const selected = options.filter((o) => value.includes(o.value));

  /* Inline (filter-bar) mode gets a pinned "All" row — clicking it clears the selection rather
   *  than toggling into it, since an empty value array already means "no filter, show everything". */
  const effectiveOptions = useMemo(
    () =>
      variant === 'inline' ? [{ value: ALL_VALUE, label: resolvedAllLabel }, ...options] : options,
    [options, variant, resolvedAllLabel],
  );

  const activateOption = (opt: MultiSelectOption) => {
    if (variant === 'inline' && opt.value === ALL_VALUE) onChange([]);
    else toggle(opt.value);
  };

  const filtered = useMemo(() => {
    if (!query) return effectiveOptions;
    const q = query.toLowerCase();
    return effectiveOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q)),
    );
  }, [effectiveOptions, query]);

  /* keep the highlighted option in range as the filtered list changes — adjusted during
     render (rather than an effect) per React's guidance for state that mirrors a prop/derived value */
  const [prevFiltered, setPrevFiltered] = useState(filtered);
  if (filtered !== prevFiltered) {
    setPrevFiltered(filtered);
    setHighlightedIndex(filtered.length > 0 ? 0 : -1);
  }

  /* scroll the highlighted option into view as it moves via keyboard */
  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  const handleTriggerClick = () => {
    if (open) {
      closeDropdown();
      setQuery('');
    } else {
      openDropdown();
      setQuery('');
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      openDropdown();
      setQuery('');
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => (filtered.length ? (i + 1) % filtered.length : -1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) =>
          filtered.length ? (i - 1 + filtered.length) % filtered.length : -1,
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
          activateOption(filtered[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        setQuery('');
        triggerRef.current?.focus();
        break;
      case 'Home':
        if (filtered.length) {
          e.preventDefault();
          setHighlightedIndex(0);
        }
        break;
      case 'End':
        if (filtered.length) {
          e.preventDefault();
          setHighlightedIndex(filtered.length - 1);
        }
        break;
    }
  };

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem) relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      {/* Selected chips */}
      {!hideChips && variant !== 'inline' && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 bg-(--module-tint,var(--color-brand-tint)) text-(--module-btn-bg,var(--color-brand)) text-xs font-medium px-2 py-1 rounded-full"
            >
              {opt.label}
              <button
                type="button"
                onClick={() => toggle(opt.value)}
                className="hover:text-(--module-btn-bg-hover,var(--color-brand-hover)) transition-colors"
              >
                <Icons.X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger — same combobox styling as SearchSelect */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          'flex items-center justify-between px-4 border rounded-input transition-colors',
          size === 'sm' ? 'py-2' : 'py-3',
          open
            ? 'bg-transparent border-(--module-btn-bg,var(--color-brand)) ring-2 ring-(--module-btn-bg,var(--color-brand))/30'
            : error
              ? 'bg-transparent border-red-500'
              : 'bg-transparent border-(--input-border,var(--color-gray-400))',
        )}
      >
        <span
          className={cn(
            'text-sm truncate min-w-0',
            selected.length > 0 || variant === 'inline' ? 'text-gray-900' : 'text-gray-400',
          )}
        >
          {selected.length === 0
            ? variant === 'inline'
              ? resolvedAllLabel
              : placeholder
            : variant === 'inline'
              ? selected.map((o) => o.label).join(', ')
              : 'Add more…'}
        </span>
        <Icons.ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 text-gray-400 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Dropdown — grid-rows trick animates height to fit actual content, so it flows down/up smoothly.
          Portaled to <body> so it isn't trapped inside a blurred/glass ancestor's stacking context. */}
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
            <div className={popupClass('min-h-0 overflow-hidden flex flex-col')}>
              <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2 border border-gray-200 rounded-input px-3 py-1.5 bg-gray-50 focus-within:border-(--module-btn-bg,var(--color-brand)) focus-within:ring-1 focus-within:ring-(--module-btn-bg,var(--color-brand))/20 transition-colors">
                  <Icons.Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      onQueryChange?.(e.target.value);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search…"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                      highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
                    }
                    className="flex-1 text-sm bg-transparent focus:outline-none text-gray-900 placeholder:text-gray-400 min-w-0"
                  />
                  {query && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setQuery('')}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Icons.X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div
                id={listboxId}
                role="listbox"
                aria-multiselectable="true"
                className="overflow-y-auto py-1"
                style={{ maxHeight: Math.min(208, dropdownPos.maxHeight - 56) }}
              >
                {filtered.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400 text-center">No results found</p>
                ) : (
                  filtered.map((opt, idx) => {
                    const isAllOption = variant === 'inline' && opt.value === ALL_VALUE;
                    const checked = isAllOption ? value.length === 0 : value.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        id={`${listboxId}-option-${idx}`}
                        role="option"
                        aria-selected={checked}
                        ref={(el) => {
                          optionRefs.current[idx] = el;
                        }}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => activateOption(opt)}
                        className={cn(
                          'w-full flex items-start gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-300 text-left transition-colors',
                          idx === highlightedIndex && 'bg-gray-300',
                        )}
                      >
                        <span
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5',
                            checked ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                          )}
                        >
                          {checked && <Icons.Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className="flex flex-col min-w-0">
                          <span>{opt.label}</span>
                          {opt.sublabel && (
                            <span className="text-xs text-gray-400 mt-0.5">{opt.sublabel}</span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
