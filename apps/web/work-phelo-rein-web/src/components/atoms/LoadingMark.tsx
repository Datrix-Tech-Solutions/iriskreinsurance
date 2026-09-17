'use client';

import { useId } from 'react';
import { usePathname } from 'next/navigation';
import { useModuleTransitionStore } from '@/store/moduleTransition.store';
import { MODULE_COLORS } from '@/components/atoms/icons';
import { cn } from '@/lib/utils';

interface LoadingMarkProps {
  icon: React.ReactNode;
  className?: string;
  /** CSS color override for the blob tint — defaults to the current module's color */
  color?: string;
}

// Centered mark for full-screen loading states (module splash, app boot) —
// gooey blobs orbit and merge behind a gently breathing icon. Resolves the
// current module's color on its own (module transition in flight, else the
// active route) unless a `color` override is passed.
export function LoadingMark({ className, color }: LoadingMarkProps) {
  const filterId = useId();
  const transitionModuleKey = useModuleTransitionStore((s) => (s.isActive ? s.moduleKey : null));
  const pathname = usePathname();

  // /:tenantSlug/:moduleKey/... — undefined outside a module route (login,
  // settings, profile, etc.), falls back to LoadingMark's own brand default.
  const moduleKey = transitionModuleKey ?? pathname?.split('/')[2];
  const resolvedColor = color ?? (moduleKey ? MODULE_COLORS[moduleKey] : undefined);

  return (
    <div
      className={cn('relative w-56 h-56 flex items-center justify-center', className)}
      style={
        resolvedColor
          ? ({ '--loading-mark-color': resolvedColor } as React.CSSProperties)
          : undefined
      }
    >
      <svg aria-hidden className="absolute w-0 h-0">
        <filter id={filterId}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
          />
        </filter>
      </svg>
      <div className="loading-mark-blob-wrap" style={{ filter: `url(#${filterId})` }}>
        <span className="loading-mark-blob loading-mark-blob-1" />
        <span className="loading-mark-blob loading-mark-blob-2" />
        <span className="loading-mark-blob loading-mark-blob-3" />
        <span className="loading-mark-blob loading-mark-blob-4" />
      </div>
      {/* icon dropped for now — re-add via loading-mark-icon-wrap when ready
      <div className="loading-mark-icon-wrap relative z-10 w-40 h-40 rounded-full flex items-center justify-center">
        {icon}
      </div>
      */}
    </div>
  );
}
