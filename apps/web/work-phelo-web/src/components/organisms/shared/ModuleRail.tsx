'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavGroup, NavItem } from './Sidebar';

/**
 * Parked module rail — a column of standalone circular icon buttons (e.g. the
 * "HR" rail shown while browsing Accounting/Operations), floating directly on
 * the page rather than sitting inside a shared card/pill. Only the current
 * item gets a filled, module-colored circle; everything else is a bare icon
 * until hovered. Deliberately its own component rather than a mode of
 * `Sidebar`: no collapse/expand, no dropdown children.
 */

interface ModuleRailProps {
  groups: NavGroup[];
}

function ModuleRailItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isCurrent = pathname === item.href || (!item.exact && pathname.startsWith(item.href + '/'));
  const isDeactivated = item.active === false;

  // The icon itself must not flex-shrink inside the circle. Icons are shared
  // with the full-size Sidebar (fixed at w-5 h-5 there), so they're scaled
  // down visually here rather than resized at the source.
  const iconEl = (
    <span className="shrink-0 flex items-center justify-center scale-[0.8]">{item.icon}</span>
  );

  return (
    <div className="relative group/tip">
      {isDeactivated ? (
        <div className="flex items-center justify-center w-7 h-7 rounded-full text-(--sidebar-rail-icon,var(--color-gray-400)) cursor-not-allowed">
          {iconEl}
        </div>
      ) : (
        <Link
          href={item.href}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-full transition-colors',
            isCurrent
              ? 'bg-(--module-btn-bg,var(--color-brand)) text-white shadow-md'
              : 'text-(--sidebar-rail-icon,var(--color-gray-500)) hover:bg-(--module-btn-bg,var(--color-brand))/10 hover:text-(--module-btn-bg,var(--color-brand))',
          )}
        >
          {iconEl}
        </Link>
      )}

      {/* Name tooltip, shown on hover */}
      <div
        className={cn(
          'pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50',
          'px-2.5 py-1.5 bg-(--chip-dark,#111827) text-white text-xs rounded-lg whitespace-nowrap',
          'opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150',
        )}
      >
        {item.label}
        {isDeactivated && <span className="ml-1.5 text-[#9ca3af] text-[10px]">(inactive)</span>}
      </div>
    </div>
  );
}

export function ModuleRail({ groups }: ModuleRailProps) {
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.enabled !== false) }))
    .filter((group) => group.items.length > 0);

  if (visibleGroups.length === 0) return null;

  return (
    <aside className="hidden md:flex flex-col items-center shrink-0 gap-6 py-3 px-1">
      {visibleGroups.map((group) => (
        <div
          key={group.label}
          className={cn(
            'flex flex-col items-center gap-1.5 py-1.5 px-1 rounded-full bg-white/40 backdrop-blur-sm border border-white/50 shadow-sm',
            'relative z-10',
          )}
        >
          {group.items.map((item) => (
            <ModuleRailItem key={item.key} item={item} />
          ))}
        </div>
      ))}
    </aside>
  );
}
