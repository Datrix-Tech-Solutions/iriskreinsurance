'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTabUsage } from '@/hooks/useTabUsage';

export interface ProfileBannerTab {
  key: string;
  label: string;
  count?: number;
}

interface ProfileBannerTabsProps {
  tabs: ProfileBannerTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  accentColor?: string | null;
  maxInline?: number;
  className?: string;
}

export function ProfileBannerTabs({
  tabs,
  activeTab,
  onTabChange,
  accentColor,
  maxInline = 5,
  className,
}: ProfileBannerTabsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reorder tabs by how often this browser has opened each one (least-used spill
  // into the "More" menu). Order is frozen per session; slot 0 stays pinned.
  const { tabs: orderedTabs, recordUse } = useTabUsage('profile-tabs-usage', tabs);

  const selectTab = (key: string) => {
    recordUse(key);
    onTabChange(key);
  };

  const hasOverflow = orderedTabs.length > maxInline;
  const primaryTabs = hasOverflow ? orderedTabs.slice(0, maxInline - 1) : orderedTabs;
  const overflowTabs = hasOverflow ? orderedTabs.slice(maxInline - 1) : [];
  const activeOverflow = overflowTabs.find((t) => t.key === activeTab);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const accentStyle = (on: boolean): CSSProperties | undefined =>
    on ? { color: accentColor || 'var(--brand)' } : undefined;

  const activeTabStyle: CSSProperties = {
    color: accentColor || 'var(--brand)',
    background: 'color-mix(in oklch, var(--module-accent, var(--brand-accent)) 5%, var(--background))',
  };

  const tabClass = (isActive: boolean) =>
    cn(
      'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-xl px-5 py-2.5 text-sm transition-colors',
      isActive ? 'font-semibold' : 'font-medium text-white/70 hover:text-white',
    );

  const badge = (count: number | undefined, isActive: boolean) =>
    (count ?? 0) > 0 ? (
      <span
        className={cn(
          'inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
          isActive ? 'bg-black/5' : 'bg-white/15 text-white',
        )}
      >
        {count}
      </span>
    ) : null;

  return (
    <div className={cn('flex items-end gap-1', className)}>
      {primaryTabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => selectTab(tab.key)}
            style={isActive ? activeTabStyle : undefined}
            className={tabClass(isActive)}
          >
            {tab.label}
            {badge(tab.count, isActive)}
          </button>
        );
      })}

      {hasOverflow && (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            style={activeOverflow ? activeTabStyle : undefined}
            className={tabClass(Boolean(activeOverflow))}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {activeOverflow ? activeOverflow.label : 'More'}
            <ChevronDown className={cn('h-4 w-4 transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 min-w-44 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5"
            >
              {overflowTabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      selectTab(tab.key);
                      setMenuOpen(false);
                    }}
                    style={accentStyle(isActive)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 whitespace-nowrap px-4 py-2 text-left text-sm transition-colors',
                      isActive ? 'font-semibold' : 'font-medium text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    {tab.label}
                    {(tab.count ?? 0) > 0 && (
                      <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-bold text-gray-600">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
