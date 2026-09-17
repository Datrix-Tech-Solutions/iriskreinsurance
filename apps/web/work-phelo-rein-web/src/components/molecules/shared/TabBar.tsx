'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TAB_ACTIVE =
  'relative text-(--tab-active-text,var(--module-btn-bg,var(--color-brand))) font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-(--tab-active-text,var(--module-btn-bg,var(--color-brand))) after:rounded-t-full';
const TAB_IDLE = 'text-gray-600 hover:text-(--text-hover-strong,var(--color-gray-900))';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  href?: string;
}

export interface TabGroup {
  tabs: TabItem[];
}

interface TabBarProps {
  /** Flat tab list. Ignored if `groups` is passed. */
  tabs?: TabItem[];
  /** Tabs split into visually-separated groups, divided by a vertical rule. */
  groups?: TabGroup[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  className?: string;
}

function TabLink({
  tab,
  isActive,
  onTabChange,
}: {
  tab: TabItem;
  isActive: boolean;
  onTabChange?: (tab: string) => void;
}) {
  const cls = cn(
    'relative px-6 py-2 text-sm transition-colors whitespace-nowrap flex items-center gap-2',
    isActive ? TAB_ACTIVE : TAB_IDLE,
  );

  const content = (
    <>
      {tab.label}
      {(tab.count ?? 0) > 0 && (
        <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
          {tab.count}
        </span>
      )}
    </>
  );

  return tab.href ? (
    <Link href={tab.href} className={cls}>
      {content}
    </Link>
  ) : (
    <button onClick={() => onTabChange?.(tab.key)} className={cls}>
      {content}
    </button>
  );
}

export function TabBar({ tabs, groups, activeTab, onTabChange, className }: TabBarProps) {
  const pathname = usePathname();
  const resolvedGroups: TabGroup[] = groups ?? [{ tabs: tabs ?? [] }];

  return (
    <div
      className={cn(
        'flex items-end gap-1 border-b border-(--module-border,var(--color-gray-200)) shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]',
        className,
      )}
    >
      {resolvedGroups.map((group, gi) => (
        <div key={gi} className="flex items-end">
          {gi > 0 && (
            <div className="self-center mx-2 w-px h-4 rounded-full bg-(--module-accent,var(--color-gray-300)) shrink-0" />
          )}
          {group.tabs.map((tab) => {
            const isActive = tab.href
              ? pathname === tab.href || pathname.startsWith(tab.href + '/')
              : activeTab === tab.key;
            return (
              <TabLink key={tab.key} tab={tab} isActive={isActive} onTabChange={onTabChange} />
            );
          })}
        </div>
      ))}
    </div>
  );
}
