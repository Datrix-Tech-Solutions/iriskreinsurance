import { cn } from '@/lib/utils';

interface QuickActionsPanelProps {
  className?: string;
  children: React.ReactNode;
}

/** Shared solid-color shell for every "Quick Actions" card (HR dashboard, operations
 * general/detailed dashboards). Deliberately solid instead of the glass surface the rest
 * of the app uses, so quick actions stand out as a distinct call-to-action block. Picks
 * up the current module's brand color via --module-btn-bg, so it themes itself per module. */
export function QuickActionsPanel({ className, children }: QuickActionsPanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-5 rounded-xl text-white',
        'shadow-[0_20px_40px_-16px_var(--qa-shadow),0_2px_8px_-2px_var(--qa-shadow),inset_0_1px_0_0_rgba(255,255,255,0.25)]',
        className,
      )}
      style={
        {
          backgroundColor: 'var(--module-btn-bg, var(--color-brand))',
          '--qa-shadow':
            'color-mix(in srgb, var(--module-btn-bg, var(--color-brand)) 45%, transparent)',
        } as React.CSSProperties
      }
    >
      <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
      {children}
    </div>
  );
}
