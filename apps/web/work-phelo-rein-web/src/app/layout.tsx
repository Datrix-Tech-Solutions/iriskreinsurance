import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastContainer } from '@/components/molecules/shared/ToastContainer';
import { ModuleSplash } from '@/components/molecules/shared/ModuleSplash';
import { NavigationLoader } from '@/components/molecules/shared/NavigationLoader';
import { AutoHideScrollbars } from '@/components/molecules/shared/AutoHideScrollbars';
import { ScrollNudgeButtons } from '@/components/molecules/shared/ScrollNudgeButtons';
import { appFont } from '@/lib/fonts';

export const metadata: Metadata = {
  title: 'WorkPhelo ERP',
  description: 'Modern ERP for African businesses',
};

// Runs before paint so a saved dark-mode preference applies immediately —
// otherwise the page would flash light before React hydrates and syncs it.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem('wp_theme');
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={appFont.variable}>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </QueryProvider>
          <ToastContainer />
          <NavigationLoader />
          <ModuleSplash />
          <AutoHideScrollbars />
          <ScrollNudgeButtons />
        </ThemeProvider>
      </body>
    </html>
  );
}
