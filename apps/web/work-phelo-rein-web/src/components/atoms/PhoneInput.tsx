'use client';

import { forwardRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';
import { useTenantConfig } from '@/hooks/useTenantConfig';

const COUNTRY_CODES = [
  { code: '+233', flag: 'GH' },
  { code: '+1', flag: 'US' },
  { code: '+44', flag: 'GB' },
  { code: '+27', flag: 'ZA' },
  { code: '+234', flag: 'NG' },
  { code: '+254', flag: 'KE' },
];

const ALL_CODES = COUNTRY_CODES.map((c) => c.code);

function parsePhone(
  raw: string | null | undefined,
  fallback: string,
): { code: string; number: string } {
  if (!raw) return { code: fallback, number: '' };
  const matched = ALL_CODES.find((c) => raw.startsWith(c));
  return matched
    ? { code: matched, number: raw.slice(matched.length).replace(/\D/g, '') }
    : { code: fallback, number: raw.replace(/\D/g, '') };
}

interface PhoneInputProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  defaultCountryCode?: string;
  className?: string;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    { label, error, placeholder = '00 000 0000', value, onChange, defaultCountryCode, className },
    ref,
  ) => {
    const { dialCode: tenantDialCode } = useTenantConfig();
    const resolvedDefault = defaultCountryCode ?? tenantDialCode;

    const isControlled = value != null;
    const parsed = isControlled
      ? parsePhone(value, resolvedDefault)
      : { code: resolvedDefault, number: '' };

    const [internalCode, setInternalCode] = useState(resolvedDefault);
    const [internalNumber, setInternalNumber] = useState('');

    // Sync dial code when tenant data loads, as long as no number has been typed yet
    useEffect(() => {
      if (!isControlled && !internalNumber) {
        setInternalCode(resolvedDefault);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedDefault]);

    const countryCode = isControlled ? parsed.code : internalCode;
    const localValue = isControlled ? parsed.number : internalNumber;

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
            className,
          )}
        >
          {/* Country code selector */}
          <div className="relative flex items-center border-r border-gray-300 px-3 bg-transparent shrink-0">
            <select
              value={countryCode}
              onChange={(e) => {
                if (!isControlled) setInternalCode(e.target.value);
                onChange?.(e.target.value + localValue);
              }}
              className="appearance-none bg-transparent text-sm text-gray-800 pr-5 focus:outline-none cursor-pointer"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 text-gray-400">
              <Icons.ChevronDown className="w-5 h-5" />
            </div>
          </div>

          {/* Number input */}
          <input
            ref={ref}
            type="tel"
            value={localValue}
            onChange={(e) => {
              const numeric = e.target.value.replace(/\D/g, '').slice(0, 10);
              if (!isControlled) setInternalNumber(numeric);
              onChange?.(countryCode + numeric);
            }}
            placeholder={placeholder}
            className="flex-1 px-4 py-2 text-sm text-gray-800 placeholder:text-gray-400 bg-transparent focus:outline-none"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);

PhoneInput.displayName = 'PhoneInput';
