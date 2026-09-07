'use client';

import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn, popupClass } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';
import { useDropdownPosition } from '@/hooks';

export interface SearchSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchSelectProps {
  label?: string;
  placeholder?: string;
  options: SearchSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  /** 'md' (default) keeps the standard py-3 height; 'sm' matches the DataTable search input (py-2). */
  size?: 'sm' | 'md';
  /** Fires on every keystroke — lets callers drive async option sources (e.g. geocoding search). */
  onQueryChange?: (query: string) => void;
  /** Rendered inside the control's own box, alongside the clear/chevron icons (e.g. a
   *  visibility toggle). Not a native <button> internally, so it nests safely here. */
  rightSlot?: React.ReactNode;
  /** For filter bars: prepends a selectable "All" option (value `''`) — makes the already-implicit
   *  "nothing selected = no filter" state a visible, explicit choice instead of just an empty field. */
  showAllOption?: boolean;
  /** Label for that "All" option. Defaults to "All {placeholder}" (e.g. "All Currency") so the
   *  field names its own dimension once collapsed, rather than showing a bare, ambiguous "All". */
  allLabel?: string;
  /** Rendered in place of the plain "No results found" message when the filtered list is
   *  empty — lets callers offer a quick action (e.g. "No account found — Create account").
   *  Receives the typed query and a `close` callback to dismiss the dropdown afterwards. */
  emptyState?: (ctx: { query: string; close: () => void }) => React.ReactNode;
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <Icons.ChevronDown className={cn('transition-transform duration-150', open && 'rotate-180')} />
  );
}

export function SearchSelect({
  label,
  placeholder = 'Select or type to search…',
  options,
  value,
  onChange,
  error,
  size = 'sm',
  onQueryChange,
  rightSlot,
  showAllOption = false,
  allLabel,
  emptyState,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  /* drives the actual grid-rows/opacity styles, one frame behind `open` on the
     way in — mounting already-expanded gives the browser nothing to transition
     from, so it just pops in instead of animating */
  const [expanded, setExpanded] = useState(false);
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

  useEffect(() => {
    if (!showDropdown || !open) return;
    const raf = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(raf);
  }, [showDropdown, open]);

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

  const effectiveOptions = useMemo(
    () =>
      showAllOption
        ? [{ value: '', label: allLabel ?? `All ${placeholder}` }, ...options]
        : options,
    [options, showAllOption, allLabel, placeholder],
  );

  const selected = effectiveOptions.find((o) => o.value === value);

  /* What the input shows:
     - when open: whatever the user is typing (query)
     - when closed: the selected label or empty */
  const inputDisplay = open ? query : (selected?.label ?? '');

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
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
          handleSelect(filtered[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        setQuery('');
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

  const handleFocus = () => {
    openDropdown();
    setQuery('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onQueryChange?.(e.target.value);
    if (!open) openDropdown();
  };

  const handleSelect = (opt: SearchSelectOption) => {
    onChange?.(opt.value);
    closeDropdown();
    setQuery('');
  };

  const handleChevronClick = () => {
    if (open) {
      closeDropdown();
      setQuery('');
    } else {
      openDropdown();
      setQuery('');
      inputRef.current?.focus();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
    setQuery('');
    closeDropdown();
  };

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem) relative" ref={containerRef}>
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      {/* Combobox input */}
      <div
        className={cn(
          'flex items-center border rounded-input px-4 transition-colors',
          open
            ? 'bg-transparent border-(--module-btn-bg,var(--color-brand)) ring-2 ring-(--module-btn-bg,var(--color-brand))/30'
            : error
              ? 'bg-transparent border-red-500'
              : 'bg-transparent border-(--input-border,var(--color-gray-400))',
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputDisplay}
          onChange={handleInputChange}
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
          className={cn(
            'flex-1 text-sm bg-transparent focus:outline-none text-gray-900 placeholder:text-gray-400 min-w-0',
            size === 'sm' ? 'py-2' : 'py-3',
          )}
        />

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {rightSlot}
          {/* Clear button — only when something is selected */}
          {value && !open && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-500 transition-colors p-0.5"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          )}
          {/* Chevron toggle */}
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
            <div className={popupClass('min-h-0 overflow-hidden')}>
              <div
                id={listboxId}
                role="listbox"
                className="overflow-y-auto py-1"
                style={{ maxHeight: Math.min(208, dropdownPos.maxHeight) }}
              >
                {filtered.length === 0 ? (
                  emptyState ? (
                    emptyState({
                      query,
                      close: () => {
                        closeDropdown();
                        setQuery('');
                      },
                    })
                  ) : (
                    <p className="px-4 py-3 text-sm text-gray-400 text-center">No results found</p>
                  )
                ) : (
                  filtered.map((opt, idx) => (
                    <button
                      key={opt.value}
                      id={`${listboxId}-option-${idx}`}
                      role="option"
                      aria-selected={opt.value === value}
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()} // prevent input blur before select fires
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => handleSelect(opt)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 text-sm transition-colors flex flex-col',
                        opt.value === value
                          ? 'bg-brand-tint text-brand font-medium'
                          : cn(
                              'text-gray-900 hover:bg-gray-300',
                              idx === highlightedIndex && 'bg-gray-300',
                            ),
                      )}
                    >
                      <span>{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-xs text-gray-400 mt-0.5">{opt.sublabel}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
