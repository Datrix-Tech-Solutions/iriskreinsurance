'use client';

import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { cn, inputClass } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        {label && (
          <label className="block truncate text-sm font-bold text-gray-900" title={label}>
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={visible ? 'text' : 'password'}
            className={inputClass(error, cn('pr-11', className))}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <Icons.Eye className="w-5 h-5" /> : <Icons.EyeOff className="w-5 h-5" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
