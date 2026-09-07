'use client';

import { use } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { SettingsContent } from '@/components/molecules/settings/SettingsContent';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function SettingsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const {} = use(params);
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <AppBackground className="h-dvh overflow-hidden flex flex-col">
      <TopNav userInitials={initials} />
      <div className="flex-1 min-h-0">
        <SettingsContent />
      </div>
    </AppBackground>
  );
}
