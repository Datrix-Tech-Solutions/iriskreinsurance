import type { ComponentPropsWithoutRef, ElementType } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type AppBackgroundProps<T extends ElementType> = {
  as?: T;
  className?: string;
  /** Opt-in full-bleed photo behind the flat fill (e.g. tenant portal) — blurred and
   * washed with the same flat-fill color so it reads as frosted glass over a photo
   * rather than a busy backdrop. */
  backgroundImage?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

// Single source of truth for the app shell background — a flat fill in the active
// module's accent color (--module-accent, see globals.css), falling back to brand accent.
export function AppBackground<T extends ElementType = 'div'>({
  as,
  className,
  backgroundImage,
  children,
  ...props
}: AppBackgroundProps<T>) {
  const Component = as ?? 'div';
  return (
    <Component
      className={cn('relative isolate', className)}
      style={{
        background:
          'color-mix(in oklch, var(--module-accent, var(--brand-accent)) 5%, var(--background))',
      }}
      {...props}
    >
      {backgroundImage ? (
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <Image
            src={backgroundImage}
            alt=""
            fill
            priority
            suppressHydrationWarning
            className="object-cover scale-110 blur-xl"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'color-mix(in oklch, var(--module-accent, var(--brand-accent)) 5%, var(--background))',
              opacity: 0.78,
            }}
          />
        </div>
      ) : (
        <div aria-hidden className="app-blob-layer">
          <div className="app-blob app-blob-1" />
          <div className="app-blob app-blob-2" />
        </div>
      )}
      {children}
    </Component>
  );
}
