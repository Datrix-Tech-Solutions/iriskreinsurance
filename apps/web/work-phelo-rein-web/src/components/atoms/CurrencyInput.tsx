'use client';

import { useState, useEffect } from 'react';
import { Icons } from '@/components/atoms/icons';
import { cn } from '@/lib/utils';

const CURRENCIES = [
  { code: 'GHS', symbol: '₵' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' },
  { code: 'NGN', symbol: '₦' },
  { code: 'KES', symbol: 'KSh' },
];

interface CurrencyInputProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value?: number | string;
  currency?: string;
  onValueChange?: (value: string) => void;
  onCurrencyChange?: (currency: string) => void;
}

export function CurrencyInput({
  label,
  error,
  placeholder = '0.00',
  value,
  currency = 'GHS',
  onValueChange,
  onCurrencyChange,
}: CurrencyInputProps) {
  const [local, setLocal] = useState(() => (value == null || value === '' ? '' : String(value)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const numeric = local === '' ? 0 : Number(local);
    const incoming = value == null || value === '' ? 0 : Number(value);
    if (incoming !== numeric) setLocal(incoming === 0 ? '' : String(incoming));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const displayValue =
    focused || local === ''
      ? local
      : Number(local).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      {label && (
        <label className="block truncate text-sm font-bold text-gray-900" title={label}>
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex border rounded-input overflow-hidden bg-transparent transition-colors',
          'focus-within:ring-2 focus-within:ring-(--module-btn-bg,var(--color-brand))/30 focus-within:border-(--module-btn-bg,var(--color-brand))',
          error ? 'border-red-500' : 'border-(--input-border,var(--color-gray-400))',
        )}
      >
        {/* Currency selector */}
        <div className="relative flex items-center border-r border-gray-300 px-3 bg-transparent shrink-0">
          <select
            value={currency}
            onChange={(e) => onCurrencyChange?.(e.target.value)}
            className="appearance-none bg-transparent text-sm text-gray-800 pr-5 focus:outline-none cursor-pointer"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2 text-gray-400">
            <Icons.ChevronDown className="w-5 h-5" />
          </div>
        </div>

        {/* Amount input */}
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, '');
            setLocal(raw);
            onValueChange?.(raw);
          }}
          placeholder={placeholder}
          className="flex-1 px-4 py-2 text-sm text-gray-800 placeholder:text-gray-400 bg-transparent focus:outline-none"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
