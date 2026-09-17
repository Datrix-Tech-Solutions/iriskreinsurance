'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import { cn, inputClass } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Rendered inside the input's own box, overlaid on the right edge (e.g. a
   *  visibility toggle) — adds room via padding so it doesn't sit over typed text. */
  rightElement?: React.ReactNode;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  type: 'textarea';
  rows?: number;
  rightElement?: React.ReactNode;
}

type Props = InputProps | TextareaProps;

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, Props>(
  ({ label, error, className, rightElement, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
        {label && (
          <label className="block truncate text-sm font-bold text-gray-900" title={label}>
            {label}
          </label>
        )}
        <div className={cn(rightElement && 'relative')}>
          {props.type === 'textarea' ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              className={cn(inputClass(error, className) + ' resize-none', rightElement && 'pr-9')}
              rows={(props as TextareaProps).rows ?? 4}
              {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className={cn(inputClass(error, className), rightElement && 'pr-9')}
              {...(props as InputHTMLAttributes<HTMLInputElement>)}
            />
          )}
          {rightElement && (
            <div
              className={cn(
                'absolute right-2',
                props.type === 'textarea' ? 'top-2' : 'top-1/2 -translate-y-1/2',
              )}
            >
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
