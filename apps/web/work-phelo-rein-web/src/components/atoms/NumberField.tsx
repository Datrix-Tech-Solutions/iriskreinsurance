'use client';

import { useState, useEffect } from 'react';
import { cn, inputClass } from '@/lib/utils';

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  /** Fired on blur with the committed numeric value — useful for normalising
   * (e.g. rounding to 2 decimals) without fighting the user while they type. */
  onBlur?: (value: number) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
}

/** Text input that shows raw digits while focused and a thousands-formatted,
 * 2-decimal value once blurred — for editable currency/amount cells. */
export function NumberField({
  value,
  onChange,
  onBlur,
  placeholder = '0.00',
  className,
  label,
  error,
  disabled,
}: NumberFieldProps) {
  const [local, setLocal] = useState(() => (value === 0 ? '' : String(value)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const numeric = local === '' ? 0 : Number(local);
    if (value !== numeric) setLocal(value === 0 ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const displayValue =
    focused || local === ''
      ? local
      : Number(local).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  const input = (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onBlur?.(local === '' ? 0 : Number(local));
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, '');
        setLocal(raw);
        onChange(raw === '' ? 0 : Number(raw));
      }}
      disabled={disabled}
      className={inputClass(error, cn(label ? 'w-full' : 'w-28 py-1.5', className))}
    />
  );

  if (!label && !error) return input;

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      {label && (
        <label className="block truncate text-sm font-bold text-gray-900" title={label}>
          {label}
        </label>
      )}
      {input}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
