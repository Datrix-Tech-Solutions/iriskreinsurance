import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading,
      loadingText,
      icon,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-input transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.1] active:scale-[0.97] disabled:hover:scale-100 shadow-sm hover:shadow-md disabled:shadow-none';

    const variants = {
      primary:
        'bg-(--module-btn-bg,var(--color-brand)) text-white border border-(--glass-border,rgba(255,255,255,0.55)) hover:bg-(--module-btn-bg-hover,var(--color-brand-hover)) focus:ring-(--module-btn-bg,var(--color-brand)) shadow-[0_4px_12px_-2px_color-mix(in_oklab,var(--module-btn-bg,var(--color-brand))_50%,transparent)] hover:shadow-[0_8px_18px_-4px_color-mix(in_oklab,var(--module-btn-bg,var(--color-brand))_60%,transparent)]',
      secondary:
        'bg-(--btn-secondary-bg,#f3f4f6) text-(--btn-secondary-text,#111827) border border-(--btn-secondary-border,#d1d5db) hover:bg-[color-mix(in_oklab,var(--module-btn-bg,var(--color-brand))_16%,transparent)] hover:text-(--btn-secondary-hover-text,var(--btn-secondary-text,#111827)) hover:border-(--module-btn-bg,var(--color-brand)) focus:ring-(--focus-ring,var(--color-gray-400))',
      outline:
        'border border-(--module-btn-bg,var(--color-brand)) text-(--module-btn-bg,var(--color-brand)) bg-transparent hover:border-2 hover:bg-[color-mix(in_oklab,var(--module-btn-bg,var(--color-brand))_8%,transparent)] focus:ring-(--module-btn-bg,var(--color-brand)) transition-all',
      ghost:
        'text-gray-700 border border-(--glass-border,rgba(255,255,255,0.55)) hover:bg-(--surface-hover,var(--color-gray-100)) focus:ring-(--focus-ring,var(--color-gray-400)) shadow-none hover:shadow-none',
      danger:
        'bg-red-600 text-white border border-(--glass-border,rgba(255,255,255,0.55)) hover:bg-red-700 focus:ring-red-500 shadow-[0_4px_12px_-2px_rgba(220,38,38,0.4)] hover:shadow-[0_8px_18px_-4px_rgba(220,38,38,0.5)]',
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-5 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant], sizes[size], icon && 'group', className)}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            {loadingText ?? children}
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-[#FFFFFF] animate-spin" />
              <div className="absolute inset-1.5 rounded-full border-3 border-transparent border-b-brand-accent animate-[spin_.6s_linear_infinite_reverse]" />
            </div>
          </span>
        ) : (
          <>
            {children}
            {icon && (
              <span className="inline-flex overflow-hidden w-0 group-hover:w-4 group-hover:ml-1.5 transition-[width,margin] duration-300 ease-out">
                <span className="shrink-0 -translate-x-4 group-hover:translate-x-0 transition-transform duration-300 ease-out">
                  {icon}
                </span>
              </span>
            )}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
