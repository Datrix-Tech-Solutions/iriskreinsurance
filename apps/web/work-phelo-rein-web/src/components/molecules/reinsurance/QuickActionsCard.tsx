'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ScrollText,
  ShieldCheck,
  BanknoteArrowUp,
  BanknoteArrowDown,
  LucideIcon,
} from 'lucide-react';
import { cn, waterIconStyle } from '@/lib/utils';
import { QuickActionsPanel } from '@/components/atoms/QuickActionsPanel';

interface QuickAction {
  label: string;
  icon: LucideIcon;
  href: string;
  color: string;
}

/** Icons mirror the reinsurance sidebar (src/config/reinsurance-nav.tsx) for the matching page.
 * Colors are distinct per action so the row reads as separate shortcuts, not one repeated tile. */
const ACTIONS: QuickAction[] = [
  { label: 'New Fac Offer', icon: ShieldCheck, href: 'facultative', color: '#2a78d6' },
  { label: 'New Treaty', icon: ScrollText, href: 'treaty', color: '#1baf7a' },
  { label: 'Make Claim', icon: BanknoteArrowUp, href: 'claims', color: '#e34948' },
  { label: 'Claim Settlements', icon: BanknoteArrowDown, href: 'payments', color: '#eb6834' },
];

interface QuickActionsCardProps {
  className?: string;
}

export function QuickActionsCard({ className }: QuickActionsCardProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  return (
    <QuickActionsPanel className={cn('h-80', className)}>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5">
        {ACTIONS.map(({ label, icon: Icon, href, color }) => (
          <Link
            key={label}
            href={`/${tenantSlug}/operations/reinsurance/${href}`}
            className="group flex items-center gap-3 rounded-2xl border border-(--qa-tile-border,rgba(255,255,255,0.4)) bg-(--qa-tile-bg,rgba(255,255,255,0.95)) px-3 py-2.5 shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:bg-(--tint) hover:shadow-lg"
            style={
              {
                '--tint': `color-mix(in oklab, ${color} 14%, var(--background))`,
              } as React.CSSProperties
            }
          >
            <div
              className="w-5 h-5 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
              style={waterIconStyle(color)}
            >
              <Icon
                className="w-4 h-4"
                style={{ color: `color-mix(in oklab, ${color} 65%, black)` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </QuickActionsPanel>
  );
}
