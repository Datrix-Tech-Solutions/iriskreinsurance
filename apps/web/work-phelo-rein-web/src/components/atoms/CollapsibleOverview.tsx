'use client';

import { useState } from 'react';
import { Icons } from '@/components/atoms/icons';
import { cardClass } from '@/lib/utils';

interface CollapsibleOverviewProps {
  title?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export function CollapsibleOverview({
  title = 'Overview',
  headerExtra,
  children,
  defaultCollapsed = false,
}: CollapsibleOverviewProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={cardClass('p-3 flex flex-col')}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
        aria-label={collapsed ? 'Expand overview' : 'Collapse overview'}
        className="flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {headerExtra}
        </div>
        <span className="text-gray-400">
          <Icons.ChevronDown
            className={`w-4 h-4 transition-transform duration-600 ${collapsed ? '-rotate-90' : ''}`}
          />
        </span>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-600 ease-in-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
          <div className="p-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
