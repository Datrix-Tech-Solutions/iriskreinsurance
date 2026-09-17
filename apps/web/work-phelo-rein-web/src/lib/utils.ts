import type { CSSProperties } from 'react';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strips a full ISO datetime (e.g. "2026-08-01T00:00:00.000Z") down to its date-only
 * portion ("2026-08-01"). Use before lexicographically comparing two date strings that
 * may come from different sources — an API's ISO timestamp vs. a date-only picker value
 * would otherwise compare unequal on the same calendar day (a date-only string is always
 * "less than" its own timestamp form since it's a string prefix of it).
 */
export function toDateOnly(date?: string | null): string {
  return date ? date.split('T')[0] : '';
}

export function inputClass(error?: string, extra?: string) {
  return cn(
    'w-full px-2 py-2 border rounded-input text-sm bg-transparent text-gray-900',
    'placeholder:text-gray-400 transition-colors',
    'focus:outline-none',
    'read-only:cursor-not-allowed read-only:bg-gray-50 read-only:text-gray-500 read-only:border-gray-200',
    error
      ? 'border-red-500 focus:ring-2 focus:ring-red-500/30 focus:border-red-500'
      : 'border-(--input-border,var(--color-gray-400)) focus:ring-2 focus:ring-(--module-btn-bg,var(--color-brand))/30 focus:border-(--module-btn-bg,var(--color-brand))',
    extra,
  );
}

/** Ambient card surface — iOS-style frosted "Liquid Glass" card: blurred translucent
 * background with a saturation boost (so content behind it stays vivid instead of
 * washing out), a soft diffused outer shadow, and a thin specular highlight along the
 * top inner edge (the light-catching rim). Used by nearly every card/toolbar/table in
 * the app. Border is unified to --glass-border everywhere now — the same edge the
 * DataTable outer card uses — so every cardClass() surface reads as one consistent
 * border regardless of context. The old 'module'/'glass' distinction no longer changes
 * anything; the param is kept (unused) purely so the ~50 existing call sites that still
 * pass it don't need touching. */
export function cardClass(extra?: string, border?: 'module' | 'glass') {
  void border;
  return cn(
    'bg-(--glass-subtle,rgba(255,255,255,0.3)) backdrop-blur-xl backdrop-saturate-150 rounded-xl',
    'border border-(--glass-border,rgba(255,255,255,0.55))',
    'shadow-[0_20px_40px_-40px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.12),inset_0_1px_0_0_var(--glass-highlight,rgba(255,255,255,0.65))]',
    extra,
  );
}

/** An "invisible" cardClass() — same layout/rounding, but never emits a background, blur,
 * border, or shadow class at all (rather than emitting cardClass()'s and trying to cancel
 * them via bg-transparent/border-transparent/shadow-none, which depended on twMerge
 * recognizing those as conflicting with cardClass()'s CSS-variable-based utilities — it
 * didn't reliably, so the surface showed through). Used for wrappers that hold DataList's
 * floating cardRows (KpiCard-style stat lists), where the surface itself shouldn't compete
 * with the rows. */
export function transparentCardClass(extra?: string) {
  return cn('rounded-xl', extra);
}

/** Popup/panel surfaces (SidePanel, DatePicker/SearchSelect/MultiSelect dropdowns) — near-solid for
 * legibility, unlike the more translucent cardClass()/glassStrongClass() ambient surfaces. Same iOS
 * "Liquid Glass" blur + saturation + specular-highlight treatment as those two. The highlight is a
 * ring rather than a raw box-shadow so it composes with a caller's own shadow (e.g. SidePanel's
 * shadow-2xl) instead of being overwritten by it. */
export function popupClass(extra?: string) {
  return cn(
    'bg-(--glass-solid,#ffffff) backdrop-blur-xl backdrop-saturate-150 rounded-card',
    'border border-(--popup-border,rgba(0,0,0,0.15)) shadow-xl ring-1 ring-inset ring-(--glass-highlight,rgba(255,255,255,0.65))',
    extra,
  );
}

/** Same "strong" glass surface as ContactCard/DataCard/ModuleButton/ReportCard/ModuleOverviewCard —
 * more opaque than cardClass(), for chrome/hover surfaces that need to stay legible. Picks up the
 * same iOS "Liquid Glass" blur + saturation + specular-highlight treatment as cardClass(), but
 * leaves the outer elevation shadow to the caller — every current consumer already supplies its own
 * shadow-lg/shadow-xl. The highlight is applied as an inset ring rather than a raw box-shadow so it
 * composes with the caller's shadow instead of overwriting it. */
export function glassStrongClass(extra?: string, border: 'module' | 'plain' | 'none' = 'module') {
  return cn(
    'bg-(--glass-strong,rgba(255,255,255,0.6)) backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-(--glass-highlight,rgba(255,255,255,0.65))',
    border === 'module' && 'border border-(--module-border,var(--color-gray-200))',
    border === 'plain' && 'border border-gray-200',
    extra,
  );
}

/** Frosted color-tint finish, same recipe as the quick-action icon circles — softer/quieter than waterAvatarStyle. */
export function frostedAvatarStyle(color: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklab, ${color} 78%, white 22%)`,
    boxShadow: `0 6px 14px -4px color-mix(in srgb, ${color} 45%, transparent)`,
  };
}

/** 3D glass/water-drop finish for an avatar circle, tinted by the given color. */
export function waterAvatarStyle(color: string): CSSProperties {
  return {
    background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.92) 0%, color-mix(in oklab, ${color} 30%, white) 30%, color-mix(in oklab, ${color} 65%, white) 60%, color-mix(in oklab, ${color} 90%, white) 100%)`,
    boxShadow: [
      `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)`,
      `inset -2px -2px 4px color-mix(in srgb, color-mix(in oklab, ${color} 60%, black) 35%, transparent)`,
      'inset 1.5px 1.5px 3px rgba(255,255,255,0.85)',
      `0 4px 8px -2px color-mix(in srgb, ${color} 55%, transparent)`,
    ].join(', '),
    textShadow: '0 1px 2px rgba(0,0,0,0.35)',
  };
}

/** Lighter, more translucent water-glass finish for a small icon circle (e.g. UpcomingHolidaysCard),
 * tinted by the given color. Lets more of the card behind it show through than waterAvatarStyle. */
export function waterIconStyle(color: string): CSSProperties {
  return {
    background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.95) 0%, color-mix(in srgb, color-mix(in oklab, ${color} 25%, white) 85%, transparent) 30%, color-mix(in srgb, color-mix(in oklab, ${color} 60%, white) 65%, transparent) 60%, color-mix(in srgb, ${color} 55%, transparent) 100%)`,
    boxShadow: [
      `inset -2px -2px 4px color-mix(in srgb, color-mix(in oklab, ${color} 70%, black) 25%, transparent)`,
      'inset 1.5px 1.5px 3px rgba(255,255,255,0.9)',
      `0 3px 6px -1px color-mix(in srgb, ${color} 45%, transparent)`,
    ].join(', '),
  };
}
