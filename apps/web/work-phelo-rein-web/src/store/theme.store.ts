import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'wp_theme';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private browsing, etc.) — theme just won't persist.
  }
}

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  // Matches the value the blocking inline script in layout.tsx already applied,
  // so this never causes a mismatched flash on first render.
  theme: 'light',
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
