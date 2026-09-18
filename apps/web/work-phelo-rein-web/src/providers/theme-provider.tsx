'use client';

import { useEffect } from 'react';
import { useThemeStore, type Theme } from '@/store/theme.store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    // The blocking inline script in layout.tsx already applied the right theme
    // to <html> before paint — this just syncs React state to match it so the
    // Appearance toggle reflects the real state on first render.
    const current = (document.documentElement.dataset.theme as Theme) ?? 'light';
    setTheme(current);
  }, [setTheme]);

  return <>{children}</>;
}
