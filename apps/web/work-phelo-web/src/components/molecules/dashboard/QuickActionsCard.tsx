'use client';

import {
  CalendarPlus,
  CalendarCheck,
  Wallet,
  Package,
  Clock,
  KanbanSquare,
  LucideIcon,
} from 'lucide-react';
import { waterIconStyle } from '@/lib/utils';
import { QuickActionsPanel } from '@/components/atoms/QuickActionsPanel';

interface QuickActionsCardProps {
  onApplyLeave: () => void;
  onLeave: () => void;
  onPayslips: () => void;
  onAssets: () => void;
  onSchedules: () => void;
  onProjects: () => void;
  leaveBadge?: number;
  projectsBadge?: number;
}

interface QuickAction {
  label: string;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
  badge?: number;
}

export function QuickActionsCard({
  onApplyLeave,
  onLeave,
  onPayslips,
  onAssets,
  onSchedules,
  onProjects,
  leaveBadge,
  projectsBadge,
}: QuickActionsCardProps) {
  /* Colors are distinct per action so the list reads as separate shortcuts, not one repeated tile. */
  const actions: QuickAction[] = [
    { label: 'Apply for Leave', icon: CalendarPlus, color: '#0d9488', onClick: onApplyLeave },
    {
      label: 'My Leave',
      icon: CalendarCheck,
      color: '#2a78d6',
      onClick: onLeave,
      badge: leaveBadge,
    },
    { label: 'My Payslips', icon: Wallet, color: '#1baf7a', onClick: onPayslips },
    { label: 'My Assets', icon: Package, color: '#eb6834', onClick: onAssets },
    { label: 'My Schedules', icon: Clock, color: '#e34948', onClick: onSchedules },
    {
      label: 'My Projects',
      icon: KanbanSquare,
      color: '#7c3aed',
      onClick: onProjects,
      badge: projectsBadge,
    },
  ];

  return (
    <QuickActionsPanel>
      <div className="flex flex-col gap-2.5">
        {actions.map(({ label, icon: Icon, color, onClick, badge }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="group relative flex w-full items-center gap-3 rounded-2xl border border-(--qa-tile-border,rgba(255,255,255,0.4)) bg-(--qa-tile-bg,rgba(255,255,255,0.95)) px-3 py-2.5 text-left shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:bg-(--tint) hover:shadow-lg"
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
      </div>
    </QuickActionsPanel>
  );
}
