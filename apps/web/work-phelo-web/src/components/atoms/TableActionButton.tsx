'use client';

import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TableActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export function TableActionButton({ icon, children, className, ...props }: TableActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-900 rounded-lg hover:bg-gray-400 transition-colors',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
