'use client';

import { useState, useRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type TableButtonVariant = 'green' | 'blue' | 'orange' | 'red' | 'gray';

const VARIANT_CLASSES: Record<TableButtonVariant, string> = {
  green: 'text-green-700 border-green-600 hover:bg-green-600',
  blue: 'text-blue-700 border-blue-600 hover:bg-blue-600',
  orange: 'text-orange-600 border-orange-500 hover:bg-orange-500',
  red: 'text-red-600 border-red-500 hover:bg-red-500',
  gray: 'text-gray-600 border-gray-400 hover:bg-gray-400',
};

const SPINNER_OUTER: Record<TableButtonVariant, string> = {
  green: 'border-t-green-600',
  blue: 'border-t-blue-600',
  orange: 'border-t-orange-500',
  red: 'border-t-red-500',
  gray: 'border-t-gray-500',
};

const SPINNER_INNER: Record<TableButtonVariant, string> = {
  green: 'border-b-green-300',
  blue: 'border-b-blue-300',
  orange: 'border-b-orange-300',
  red: 'border-b-red-300',
  gray: 'border-b-gray-300',
};

const TOOLTIP_MAX_WIDTH = 240;
const EDGE_GAP = 8;

interface TableButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: TableButtonVariant;
  tooltip?: string;
}

export function TableButton({
  isLoading,
  disabled,
  variant = 'green',
  tooltip,
  children,
  className,
  ...props
}: TableButtonProps) {
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (!tooltip || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const idealLeft = rect.left + rect.width / 2 - TOOLTIP_MAX_WIDTH / 2;
    const clampedLeft = Math.max(
      EDGE_GAP,
      Math.min(idealLeft, window.innerWidth - TOOLTIP_MAX_WIDTH - EDGE_GAP),
    );
    setTooltipPos({ left: clampedLeft, top: rect.top });
  };

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled || isLoading}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltipPos(null)}
        className={cn(
          'text-xs font-medium border hover:text-white hover:scale-[1.2] active:scale-[0.97] rounded px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
          VARIANT_CLASSES[variant],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center justify-center w-8">
            <span className="relative w-3.5 h-3.5">
              <span
                className={cn(
                  'absolute inset-0 rounded-full border-2 border-transparent animate-spin',
                  SPINNER_OUTER[variant],
                )}
              />
              <span
                className={cn(
                  'absolute inset-0.75 rounded-full border-2 border-transparent animate-[spin_.6s_linear_infinite_reverse]',
                  SPINNER_INNER[variant],
                )}
              />
            </span>
          </span>
        ) : (
          children
        )}
      </button>

      {tooltipPos && tooltip && (
        <span
          style={{
            position: 'fixed',
            left: tooltipPos.left,
            top: tooltipPos.top - 8,
            width: TOOLTIP_MAX_WIDTH,
            transform: 'translateY(-100%)',
            zIndex: 9999,
          }}
          className="pointer-events-none"
        >
          <span className="block bg-(--chip-dark,#111827) text-white text-xs rounded-lg px-1 py-1.5 whitespace-nowrap shadow-lg text-center">
            {tooltip}
          </span>
          <span className="block w-2 h-2 bg-(--chip-dark,#111827) rotate-45 rounded-sm mx-auto -mt-1" />
        </span>
      )}
    </span>
  );
}
