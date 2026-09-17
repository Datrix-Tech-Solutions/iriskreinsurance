'use client';

import { useModuleTransitionStore } from '@/store/moduleTransition.store';
import { useNavigationLoader } from '@/hooks/useNavigationLoader';
import { LoadingMark } from '@/components/atoms/LoadingMark';
import { cn, glassStrongClass } from '@/lib/utils';

// Generic full-screen cue for ordinary page navigation — the deployed app has
// no equivalent to the local dev "compiling…" indicator, so without this a
// click on any nav link looks like nothing happened until the next page lands.
// Deliberately generic/unbranded, unlike ModuleSplash (reserved for deliberate
// module-switch branding) — this one is gated off whenever that splash is
// active so the two never stack.
export function NavigationLoader() {
  const moduleSplashActive = useModuleTransitionStore((s) => s.isActive);
  const { visible, closing, fadeMs } = useNavigationLoader();

  if (moduleSplashActive || !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className={cn(
        glassStrongClass(''),
        'fixed inset-0 z-150 flex items-center justify-center transition-opacity',
        closing ? 'opacity-0' : 'opacity-100',
      )}
      style={{ transitionDuration: `${fadeMs}ms` }}
    >
      <div className="relative flex items-center justify-center">
        <div aria-hidden className="absolute w-40 h-40 rounded-full bg-brand/15 blur-xl" />
        <LoadingMark icon={<span className="block w-10 h-10 rounded-full bg-brand shadow-md" />} />
      </div>
    </div>
  );
}
