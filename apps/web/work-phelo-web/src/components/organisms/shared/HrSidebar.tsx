'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useModuleTransition } from '@/hooks';
import { NavGroup, NavItem } from './Sidebar';

/**
 * HR's own sidebar — deliberately not `Sidebar.tsx` (which the other modules'
 * own full sidebars still use unchanged). Both collapsed and expanded share
 * the same frosted-glass surface the notification panel uses (translucent +
 * blurred, no border) — collapsed is a round-selection icon rail the same
 * width as the parked `ModuleRail`; on hover it expands into a wider labeled
 * flyout that overlaps the page rather than pushing it (no dimming — just an
 * invisible click-catcher to close it), retracting when the pointer leaves.
 * `forceOpen` pins it open without needing hover (wired to a button in TopNav).
 */

interface HrSidebarProps {
  groups: NavGroup[];
  forceOpen?: boolean;
  /** Called when the invisible click-catcher behind the expanded flyout is
   *  clicked — wire this to un-pin `forceOpen`, same as clicking outside used
   *  to close the old mobile drawer. */
  onRequestClose?: () => void;
}

function HrSidebarItem({
  item,
  expanded,
  onNavigate,
  onModuleNavigate,
}: {
  item: NavItem;
  expanded: boolean;
  onNavigate: () => void;
  /** When set, this item switches modules — run the module-loading transition
   *  instead of a plain client navigation. */
  onModuleNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isCurrent = pathname === item.href || (!item.exact && pathname.startsWith(item.href + '/'));
  const isDeactivated = item.active === false;

  const iconEl = <span className="shrink-0 flex items-center justify-center">{item.icon}</span>;

  const baseRow = cn(
    'relative flex items-center transition-colors',
    // Collapsed: a fixed circular button (round, not a rounded rectangle).
    // Expanded: a full-width labeled row.
    expanded ? 'rounded-input w-full px-3 py-2 gap-3' : 'rounded-full w-7 h-7 mx-auto justify-center',
  );

  const content = (
    <>
      {iconEl}
      <span
        className={cn(
          'text-sm whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200',
          expanded ? 'max-w-44 opacity-100 delay-100' : 'max-w-0 opacity-0',
        )}
      >
        {item.label}
      </span>
    </>
  );

  const wrapperPx = expanded ? 'px-2' : 'px-1.5';

  if (isDeactivated) {
    return (
      <div className={wrapperPx}>
        <div className={cn(baseRow, 'text-gray-300 cursor-not-allowed')}>{content}</div>
      </div>
    );
  }

  return (
    <div className={wrapperPx}>
      <Link
        href={item.href}
        onClick={(e) => {
          if (onModuleNavigate) {
            e.preventDefault();
            onModuleNavigate();
          } else {
            onNavigate();
          }
        }}
        className={cn(
          baseRow,
          isCurrent
            ? 'bg-(--module-btn-bg,var(--color-brand)) text-white font-semibold shadow-sm'
            : 'text-gray-600 hover:bg-gray-900/5 hover:text-gray-900',
        )}
      >
        {content}
      </Link>
    </div>
  );
}

export function HrSidebar({ groups, forceOpen = false, onRequestClose }: HrSidebarProps) {
  const [isHovering, setIsHovering] = useState(false);
  const expanded = forceOpen || isHovering;
  const { navigateToModule } = useModuleTransition();

  // Collapse back after picking a page, whether it was open via hover or pinned.
  const handleNavigate = () => {
    setIsHovering(false);
    onRequestClose?.();
  };

  return (
    <>
      {/* Reserves permanent layout space at the closed width — the expanded
          flyout below is positioned absolutely, so it overlaps the content
          instead of resizing this reserved column. */}
      <div className="w-11 shrink-0" />

      {/* Invisible click-catcher over the page while expanded — closes the
          flyout on click, same as clicking outside closed the old mobile
          drawer, without visually dimming the app. */}
      {expanded && <div aria-hidden onClick={onRequestClose} className="absolute inset-0 z-30" />}

      <aside
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={cn(
          'absolute inset-y-0 left-0 z-40 flex flex-col shrink-0 overflow-hidden',
          'transition-[width] duration-350 ease-[cubic-bezier(0.34,1.8,0.64,1)]',
          // Same frosted surface the notification panel (SidePanel glass / cardClass)
          // uses, minus its border — collapsed and expanded share this background.
          // Collapsed has no shadow/elevation, so it blends into the page until hovered.
          'bg-(--glass-subtle,rgba(255,255,255,0.3)) backdrop-blur-xl backdrop-saturate-150',
          expanded ? 'w-50 shadow-xl' : 'w-11',
        )}
      >
        <nav className="flex-1 overflow-y-auto pt-10 pb-2 flex flex-col">
          {groups.map((group) => {
            const visibleItems = group.items.filter((item) => item.enabled !== false);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="mb-1">
                {expanded ? (
                  <p className="px-5 pt-3 pb-1.5 text-[10px] font-semibold tracking-widest text-gray-400 uppercase select-none">
                    {group.label}
                  </p>
                ) : (
                  <div className="mx-3 my-2 h-px bg-gray-900/10" />
                )}
                <div className="flex flex-col gap-0.5">
                  {visibleItems.map((item) => (
                    <HrSidebarItem
                      key={item.key}
                      item={item}
                      expanded={expanded}
                      onNavigate={handleNavigate}
                      onModuleNavigate={
                        group.label === 'Modules'
                          ? () => {
                              handleNavigate();
                              navigateToModule({
                                moduleKey: item.key,
                                moduleName: item.label,
                                path: item.href,
                              });
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
