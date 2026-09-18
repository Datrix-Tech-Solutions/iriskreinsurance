'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useModuleTransitionStore } from '@/store/moduleTransition.store';
import { ModuleIcons, MODULE_COLORS, type ModuleKey } from '@/components/atoms/icons';
import { LoadingMark } from '@/components/atoms/LoadingMark';
import { cn } from '@/lib/utils';

// Deliberate branding pause — keeps the splash from flashing on fast navigations.
const MIN_VISIBLE_MS = 2500;
const FADE_MS = 200;
// Last-resort circuit breaker, not the normal close path — the splash is meant to
// hide only once the "landed" effect below sees the pathname actually change away
// from originPath. Module routes often fetch data on load, so on a slow network
// landing can take several seconds; this must be long enough that it never fires
// for that case, so it only ever catches a genuinely stuck navigation (stalled
// redirect, auth failure) instead of masking one as a normal load.
const SAFETY_MS = 20000;

type ArcOrigin = 'top-left' | 'bottom-right' | 'center' | 'top-right' | 'bottom-left';

interface ArcConfig {
  id: number;
  tint: 'light' | 'dark';
  opacity: number;
  sizeRange: [number, number]; // vmax
  origin: ArcOrigin;
}

const ARC_CONFIGS: ArcConfig[] = [
  { id: 1, tint: 'light', opacity: 0.35, sizeRange: [55, 90], origin: 'top-left' },
  { id: 2, tint: 'dark', opacity: 0.55, sizeRange: [85, 120], origin: 'bottom-right' },
  { id: 3, tint: 'light', opacity: 0.3, sizeRange: [40, 70], origin: 'center' },
  { id: 4, tint: 'light', opacity: 0.25, sizeRange: [35, 60], origin: 'top-right' },
  { id: 5, tint: 'dark', opacity: 0.4, sizeRange: [40, 65], origin: 'bottom-left' },
];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomArcPosition(origin: ArcOrigin): React.CSSProperties {
  switch (origin) {
    case 'top-left':
      return { top: `${randomBetween(-40, -15)}%`, left: `${randomBetween(-35, -10)}%` };
    case 'bottom-right':
      return { bottom: `${randomBetween(-65, -35)}%`, right: `${randomBetween(-40, -15)}%` };
    case 'top-right':
      return { top: `${randomBetween(-30, -10)}%`, right: `${randomBetween(-30, -10)}%` };
    case 'bottom-left':
      return { bottom: `${randomBetween(-30, -10)}%`, left: `${randomBetween(-25, -5)}%` };
    case 'center':
    default:
      return { top: `${randomBetween(0, 25)}%`, left: `${randomBetween(15, 45)}%` };
  }
}

function generateArcs() {
  return ARC_CONFIGS.map((cfg) => ({
    ...cfg,
    size: randomBetween(cfg.sizeRange[0], cfg.sizeRange[1]),
    position: randomArcPosition(cfg.origin),
  }));
}

export function ModuleSplash() {
  const isActive = useModuleTransitionStore((s) => s.isActive);
  const moduleKey = useModuleTransitionStore((s) => s.moduleKey);
  const moduleName = useModuleTransitionStore((s) => s.moduleName);
  const originPath = useModuleTransitionStore((s) => s.originPath);
  const finish = useModuleTransitionStore((s) => s.finish);

  const pathname = usePathname();
  const [closing, setClosing] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    if (!isActive) return;

    startedAtRef.current = Date.now();
    timersRef.current.push(setTimeout(() => setClosing(true), SAFETY_MS));

    return clearTimers;
  }, [isActive, moduleKey]);

  useEffect(() => {
    if (!isActive || closing) return;
    if (pathname === originPath) return; // still on the origin page — navigation hasn't landed yet

    const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
    clearTimers();
    timersRef.current.push(
      setTimeout(() => setClosing(true), Math.max(0, MIN_VISIBLE_MS - elapsed)),
    );
  }, [pathname, isActive, closing, originPath]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      finish();
      setClosing(false);
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [closing, finish]);

  // Freshly randomized each time the splash appears, not on every render.
  const arcs = useMemo(() => (isActive ? generateArcs() : []), [isActive]);

  if (!isActive || !moduleKey) return null;

  const Icon = ModuleIcons[moduleKey as ModuleKey];
  const background = MODULE_COLORS[moduleKey] ?? 'var(--brand)';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading ${moduleName ?? 'module'}`}
      className={cn(
        'module-splash-bg fixed inset-0 z-200 flex flex-col items-center justify-center gap-6 overflow-hidden transition-opacity',
        closing ? 'opacity-0' : 'opacity-100',
      )}
      style={
        {
          '--splash-color': background,
          transitionDuration: `${FADE_MS}ms`,
        } as React.CSSProperties
      }
    >
      {arcs.map((arc) => (
        <div
          key={arc.id}
          className={cn(
            'module-splash-arc',
            `module-splash-arc-${arc.id}`,
            arc.tint === 'light' ? 'module-splash-arc-light' : 'module-splash-arc-dark',
          )}
          style={{
            opacity: arc.opacity,
            width: `${arc.size}vmax`,
            height: `${arc.size}vmax`,
            ...arc.position,
          }}
        />
      ))}

      <LoadingMark
        className="z-10"
        icon={Icon && <Icon className="w-20 h-20 text-white drop-shadow-lg" />}
      />

      {moduleName && (
        <p className="relative z-10 text-sm font-medium text-white/90">
          Loading {moduleName} Module…
        </p>
      )}
    </div>
  );
}
