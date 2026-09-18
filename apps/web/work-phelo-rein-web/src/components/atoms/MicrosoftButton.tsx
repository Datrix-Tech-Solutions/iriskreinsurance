import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type MicrosoftButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const MicrosoftButton = forwardRef<HTMLButtonElement, MicrosoftButtonProps>(
  ({ className, children = 'Microsoft', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-3 px-2 py-2 rounded-input',
          'bg-gray-100 hover:bg-gray-200 transition-colors',
          'text-sm font-medium text-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2',
          'disabled:opacity-70 disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="8.5" height="8.5" fill="#F25022" />
          <rect x="9.5" y="0" width="8.5" height="8.5" fill="#7FBA00" />
          <rect x="0" y="9.5" width="8.5" height="8.5" fill="#00A4EF" />
          <rect x="9.5" y="9.5" width="8.5" height="8.5" fill="#FFB900" />
        </svg>
        {children}
      </button>
    );
  },
);

MicrosoftButton.displayName = 'MicrosoftButton';
