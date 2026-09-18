import { cn } from '@/lib/utils';

/** A single tab in a card's own tabbed header (e.g. Leave Balances / Requests, Roles / Permissions) —
 *  distinct from the page-level `TabBar`, sized and spaced to sit inside a `SectionCard`-style header. */
export function HeaderTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative px-1 pb-2 pt-1 text-sm font-semibold transition-colors whitespace-nowrap flex items-center',
        active
          ? 'text-(--module-btn-bg,var(--color-brand)) after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-(--module-btn-bg,var(--color-brand))'
          : 'text-gray-400 hover:text-gray-600',
      )}
    >
      {children}
    </button>
  );
}
