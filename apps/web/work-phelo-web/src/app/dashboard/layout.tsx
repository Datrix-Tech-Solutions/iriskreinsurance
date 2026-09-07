// SUPER ADMIN LAYOUT //

'use client';

import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'Admin';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <AppBackground className="h-dvh overflow-hidden flex flex-col">
      <TopNav userInitials={initials} logoVariant="image" />
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </AppBackground>
  );
}
