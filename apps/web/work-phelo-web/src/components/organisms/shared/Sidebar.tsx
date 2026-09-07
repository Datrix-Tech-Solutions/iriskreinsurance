'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────── Types ─────────────────────────── */

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  // enabled false cannot be seen at all used by company admin
  enabled?: boolean;
  // active false make it inactive used by superadmin for feature control //
  active?: boolean;
  // exact true means only highlight on exact path match (use for index/dashboard routes)
  exact?: boolean;
  // children turns this item into a collapsible dropdown section
  children?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  groups: NavGroup[];
  collapsed?: boolean;
}

/* ─────────────────────────── Item ─────────────────────────── */

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isCurrent = pathname === item.href || (!item.exact && pathname.startsWith(item.href + '/'));
  const isDeactivated = item.active === false;

  const iconEl = (
    <span
      className={cn(
        'shrink-0 flex items-center justify-center',
        isDeactivated
          ? 'text-white/30'
          : isCurrent
            ? 'text-(--sidebar-active-text,var(--module-btn-bg,var(--color-brand)))'
            : 'text-white/70',
      )}
    >
      {item.icon}
    </span>
  );

  const inner = (
    <>
      {iconEl}
      <span
        className={cn(
          'text-sm whitespace-nowrap overflow-hidden transition-[max-width,opacity,transform] duration-500',
          collapsed
            ? 'max-w-0 opacity-0 -translate-x-3'
            : 'max-w-44 opacity-100 translate-x-0 delay-100',
        )}
      >
        {item.label}
      </span>
    </>
  );

  const baseRow = cn(
    'relative flex items-center rounded-input transition-colors w-full',
    collapsed ? 'justify-center px-0 py-2 gap-0' : 'px-2 py-2 gap-3',
  );

  return (
    /* tooltip wrapper */
    <div className="relative group/tip px-2">
      {/* Active left-bar accent */}
      {isCurrent && !isDeactivated && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.75 bg-white rounded-r-full" />
      )}

      {isDeactivated ? (
        /* Deactivated — visible but non-clickable, grayed out */
        <div
          title={collapsed ? item.label : undefined}
          className={cn(baseRow, 'cursor-not-allowed text-white/30')}
        >
          {inner}
        </div>
      ) : (
        /* Normal / current */
        <Link
          href={item.href}
          className={cn(
            baseRow,
            isCurrent
              ? 'bg-(--sidebar-active-bg,white) text-(--sidebar-active-text,var(--module-btn-bg,var(--color-brand))) font-semibold shadow-sm border border-(--glass-border,rgba(255,255,255,0.55))'
              : 'text-white/80 hover:bg-white/10 hover:text-white',
          )}
        >
          {inner}
        </Link>
      )}

      {/* Tooltip — only when collapsed */}
      {collapsed && (
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
      )}
    </div>
  );
}

/* ──────────────────────── Child Item ───────────────────────── */

function SidebarChildItem({
  item,
  variant = 'light',
}: {
  item: NavItem;
  /** 'light' — inside the white flyout popup (collapsed mode). 'onColor' — inline in the module-colored sidebar. */
  variant?: 'light' | 'onColor';
}) {
  const pathname = usePathname();
  const isCurrent = pathname === item.href || pathname.startsWith(item.href + '/');
  const isDeactivated = item.active === false;

  const baseRow = 'flex items-center px-2 py-2 rounded-input transition-colors w-full text-sm';

  if (isDeactivated) {
    return (
      <div
        className={cn(
          baseRow,
          'cursor-not-allowed',
          variant === 'onColor' ? 'text-white/30' : 'text-gray-400',
        )}
      >
        <span className="truncate">{item.label}</span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        baseRow,
        isCurrent
          ? variant === 'onColor'
            ? 'bg-(--sidebar-active-bg,white) text-(--sidebar-active-text,var(--module-btn-bg,var(--color-brand))) font-semibold'
            : 'bg-(--module-btn-bg,var(--color-brand)) text-white font-semibold'
          : variant === 'onColor'
            ? 'text-white/70 hover:bg-white/10 hover:text-white'
            : 'text-gray-500 hover:bg-(--surface-hover-subtle,var(--color-gray-50)) hover:text-(--text-hover-strong,var(--color-gray-900))',
      )}
    >
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/* ─────────────────────── Dropdown Item ─────────────────────── */

function SidebarDropdownItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();

  const isAnyChildActive =
    item.children?.some(
      (child) => pathname === child.href || pathname.startsWith(child.href + '/'),
    ) ?? false;

  const [open, setOpen] = useState(false);

  // A child route being active always forces the section open
  const isOpen = open || isAnyChildActive;

  const isDeactivated = item.active === false;

  const baseRow = cn(
    'relative flex items-center rounded-input transition-colors w-full',
    collapsed ? 'justify-center px-0 py-2 gap-0' : 'px-2 py-2 gap-3',
  );

  return (
    <div className="relative group/tip px-2">
      {/* Highlight bar when a child is active */}
      {isAnyChildActive && !isDeactivated && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.75 bg-white rounded-r-full" />
      )}

      <button
        type="button"
        disabled={isDeactivated}
        onClick={() => {
          if (!collapsed) setOpen((v) => !v || isAnyChildActive);
        }}
        className={cn(
          baseRow,
          isDeactivated
            ? 'cursor-not-allowed text-white/30'
            : isAnyChildActive
              ? 'bg-(--sidebar-active-bg,white) text-(--sidebar-active-text,var(--module-btn-bg,var(--color-brand))) font-semibold shadow-sm border border-(--glass-border,rgba(255,255,255,0.55))'
              : 'text-white/80 hover:bg-white/10 hover:text-white',
        )}
      >
        <span
          className={cn(
            'shrink-0 flex items-center justify-center',
            isDeactivated
              ? 'text-white/30'
              : isAnyChildActive
                ? 'text-(--sidebar-active-text,var(--module-btn-bg,var(--color-brand)))'
                : 'text-white/70',
          )}
        >
          {item.icon}
        </span>

        <span
          className={cn(
            'text-sm whitespace-nowrap overflow-hidden flex-1 text-left transition-[max-width,opacity,transform] duration-500',
            collapsed
              ? 'max-w-0 opacity-0 -translate-x-3'
              : 'max-w-44 opacity-100 translate-x-0 delay-100',
          )}
        >
          {item.label}
        </span>
        <span
          className={cn(
            'overflow-hidden transition-[max-width,opacity] duration-500',
            collapsed ? 'max-w-0 opacity-0' : 'max-w-6 opacity-100 delay-100',
          )}
        >
          <ChevronDown
            className={cn(
              'w-4 h-4 shrink-0 transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </span>
      </button>

      {/* Flyout menu when collapsed */}
      {collapsed && (
        <div
          className={cn(
            'absolute left-full top-0 ml-2 z-50',
            'opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150',
            'pointer-events-none group-hover/tip:pointer-events-auto',
          )}
        >
          {/* Invisible bridge to prevent hover gap closing the flyout */}
          <div className="absolute right-full top-0 bottom-0 w-2" />
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 min-w-40">
            <p className="px-3 py-1.5 text-[10px] font-semibold tracking-widest text-gray-400 uppercase select-none">
              {item.label}
            </p>
            {item.children
              ?.filter((child) => child.enabled !== false)
              .map((child) => (
                <SidebarChildItem key={child.key} item={child} />
              ))}
          </div>
        </div>
      )}

      {/* Children list — only in expanded sidebar */}
      {!collapsed && (
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-500 ease-in-out',
            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-white/20 pl-2">
              {item.children
                ?.filter((child) => child.enabled !== false)
                .map((child) => (
                  <SidebarChildItem key={child.key} item={child} variant="onColor" />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Sidebar ─────────────────────────── */

export function Sidebar({ groups, collapsed = false }: SidebarProps) {
  const [isHovering, setIsHovering] = useState(false);
  const effectiveCollapsed = collapsed && !isHovering;

  return (
    <aside
      onMouseEnter={() => collapsed && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        'bg-(--sidebar-bg,var(--module-btn-bg,var(--color-brand))) border-r border-(--sidebar-border,rgba(255,255,255,0.1)) shadow-lg flex flex-col shrink-0 overflow-hidden',
        // Mobile: absolute drawer that slides over content (below the top nav)
        'absolute inset-y-0 left-0 z-40 w-60 transition-transform duration-200',
        // Desktop: static in flex flow with width animation (spring curve)
        'md:relative md:z-auto md:translate-x-0 md:transition-[width] md:duration-350 md:ease-[cubic-bezier(0.34,1.8,0.64,1)]',
        effectiveCollapsed ? '-translate-x-full md:w-14' : 'translate-x-0 md:w-50',
      )}
    >
      <nav className="flex-1 overflow-y-auto pt-10 pb-2 flex flex-col">
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => item.enabled !== false);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-1">
              {/* Group label / divider */}
              {effectiveCollapsed ? (
                <div className="mx-3 my-2 h-px bg-white/20" />
              ) : (
                <p className="px-5 pt-3 pb-1.5 text-[10px] font-semibold tracking-widest text-white/50 uppercase select-none">
                  {group.label}
                </p>
              )}

              {/* Nav items */}
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) =>
                  item.children?.length ? (
                    <SidebarDropdownItem
                      key={item.key}
                      item={item}
                      collapsed={effectiveCollapsed}
                    />
                  ) : (
                    <SidebarItem key={item.key} item={item} collapsed={effectiveCollapsed} />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
