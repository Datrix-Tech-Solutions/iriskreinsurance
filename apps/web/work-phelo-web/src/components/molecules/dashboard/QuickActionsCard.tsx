'use client';

import { useMemo, useState } from 'react';
import {
  CalendarPlus,
  CalendarCheck,
  Wallet,
  Package,
  Clock,
  KanbanSquare,
  ChevronDown,
  LucideIcon,
} from 'lucide-react';
import { waterIconStyle } from '@/lib/utils';
import { QuickActionsPanel } from '@/components/atoms/QuickActionsPanel';
import { ModuleIcons, MODULE_COLORS } from '@/components/atoms/icons';
import { useTabUsage } from '@/hooks/useTabUsage';

export interface QuickActionModule {
  key: string;
  label: string;
  href: string;
}

interface QuickActionsCardProps {
  onApplyLeave: () => void;
  onLeave: () => void;
  onPayslips: () => void;
  onAssets: () => void;
  onSchedules: () => void;
  onProjects: () => void;
  leaveBadge?: number;
  projectsBadge?: number;
  /** Modules the user has access to — mirrors the sidebar's "Modules" group. */
  modules?: QuickActionModule[];
  onModule?: (module: QuickActionModule) => void;
}

interface Entry {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
  badge?: number;
}

const MAX_INLINE = 5;

export function QuickActionsCard({
  onApplyLeave,
  onLeave,
  onPayslips,
  onAssets,
  onSchedules,
  onProjects,
  leaveBadge,
  projectsBadge,
  modules = [],
  onModule,
}: QuickActionsCardProps) {
  const [expanded, setExpanded] = useState(false);

  /* Personal shortcuts + accessible modules, one flat list. Colors are distinct
     per entry so it reads as separate shortcuts, not one repeated tile. */
  const entries = useMemo<Entry[]>(() => {
    const personal: Entry[] = [
      {
        key: 'apply-leave',
        label: 'Apply for Leave',
        icon: CalendarPlus,
        color: '#0d9488',
        onClick: onApplyLeave,
      },
      {
        key: 'my-leave',
        label: 'My Leave',
        icon: CalendarCheck,
        color: '#2a78d6',
        onClick: onLeave,
        badge: leaveBadge,
      },
      { key: 'my-payslips', label: 'My Payslips', icon: Wallet, color: '#1baf7a', onClick: onPayslips },
      { key: 'my-assets', label: 'My Assets', icon: Package, color: '#eb6834', onClick: onAssets },
      {
        key: 'my-schedules',
        label: 'My Schedules',
        icon: Clock,
        color: '#e34948',
        onClick: onSchedules,
      },
      {
        key: 'my-projects',
        label: 'My Projects',
        icon: KanbanSquare,
        color: '#7c3aed',
        onClick: onProjects,
        badge: projectsBadge,
      },
    ];

    const moduleEntries: Entry[] = modules.map((module) => ({
      key: `module:${module.key}`,
      label: module.label,
      icon: ModuleIcons[module.key as keyof typeof ModuleIcons] ?? KanbanSquare,
      color: MODULE_COLORS[module.key] ?? 'var(--color-brand)',
      onClick: () => onModule?.(module),
    }));

    return [...personal, ...moduleEntries];
  }, [
    onApplyLeave,
    onLeave,
    onPayslips,
    onAssets,
    onSchedules,
    onProjects,
    leaveBadge,
    projectsBadge,
    modules,
    onModule,
  ]);

  // Float the most-used entries to the top (frozen per session), least-used
  // spill below the "More" toggle — same behaviour as the profile tabs.
  const { tabs: ordered, recordUse } = useTabUsage('dashboard-quick-actions-usage', entries, {
    pinFirst: false,
  });

  const hasOverflow = ordered.length > MAX_INLINE;
  const primary = hasOverflow ? ordered.slice(0, MAX_INLINE - 1) : ordered;
  const overflow = hasOverflow ? ordered.slice(MAX_INLINE - 1) : [];
  const visible = expanded ? [...primary, ...overflow] : primary;

  const tileClass =
    'group relative flex w-full items-center gap-3 rounded-2xl border border-(--qa-tile-border,rgba(255,255,255,0.4)) bg-(--qa-tile-bg,rgba(255,255,255,0.95)) px-3 py-2.5 text-left shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:bg-(--tint) hover:shadow-lg';

  return (
    <QuickActionsPanel>
      <div className="flex flex-col gap-2.5">
        {visible.map(({ key, label, icon: Icon, color, onClick, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              recordUse(key);
              onClick();
            }}
            className={tileClass}
            style={
              {
                '--tint': `color-mix(in oklab, ${color} 14%, var(--background))`,
              } as React.CSSProperties
            }
          >
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
              style={waterIconStyle(color)}
            >
              <Icon
                className="w-4 h-4"
                style={{ color: `color-mix(in oklab, ${color} 65%, black)` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
            {badge != null && badge > 0 && (
              <span className="ml-auto min-w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        ))}

        {hasOverflow && (
          <button
            type="button"
            onClick={() => setExpanded((o) => !o)}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
          >
            {expanded ? 'Show less' : `More (${overflow.length})`}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>
    </QuickActionsPanel>
  );
}
