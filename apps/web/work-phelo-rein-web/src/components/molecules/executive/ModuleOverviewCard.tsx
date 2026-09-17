'use client';

import type { ReactNode } from 'react';
import { cn, glassStrongClass, frostedAvatarStyle } from '@/lib/utils';

interface ModuleOverviewCardProps {
  name: string;
  icon: ReactNode;
  color: string;
  className?: string;
  /** Extra content below the module name — left empty by default. */
  children?: ReactNode;
}

/** Overview card for a single module — same glass surface as the navbar/sidebar. */
export function ModuleOverviewCard({
  name,
  icon,
  color,
  className,
  children,
}: ModuleOverviewCardProps) {
  return (
    <div
      className={glassStrongClass(
        cn('rounded-card shadow-lg p-6 min-h-100 flex flex-col gap-5', className),
      )}
    >
      <div className="flex items-center gap-3 shrink-0">
        <div
          className="w-8 h-8 rounded-card flex items-center justify-center text-white shrink-0"
          style={frostedAvatarStyle(color)}
        >
          {icon}
        </div>
        <h3 className="text-lg font-bold text-gray-900">{name}</h3>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
