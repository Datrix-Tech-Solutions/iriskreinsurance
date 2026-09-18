// TENANT PORTAL LAYOUT — shared TopNav/tabs for the Modules and Executive Dashboard pages

'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav, NavTab } from '@/components/organisms/shared/TopNav';
import { AppBackground } from '@/components/atoms/AppBackground';
import { MoodSelectorModal } from '@/components/organisms/shared/MoodSelectorModal';

const PORTAL_BACKGROUNDS = [
  // '/background/backone.jpg',
  // '/background/backtwo.jpg',
  '/background/backthree.jpg',
];

export default function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  // const isTenantAdmin = user?.role === 'TENANT_ADMIN';

  // Picked once per mount (i.e. each fresh visit to the portal, such as after login) so the
  // three photos rotate. Server and client each roll independently, which is an intentional,
  // purely cosmetic hydration mismatch — suppressed on the <Image> in AppBackground.
  const [background] = useState(
    () => PORTAL_BACKGROUNDS[Math.floor(Math.random() * PORTAL_BACKGROUNDS.length)],
  );

  const tabs: NavTab[] = [{ key: 'modules', label: 'Modules', href: `/${tenantSlug}/modules` }];
  // if (isTenantAdmin) {
  //   tabs.push({ key: 'executive', label: 'Executive Dashboard', href: `/${tenantSlug}/executive` });
  // }

  return (
    <AppBackground backgroundImage={background} className="h-dvh overflow-hidden flex flex-col">
      <TopNav
        userInitials={initials}
        logoVariant="image"
        //remember to comment out the tabs when pushing to production because the executive dashboard is not ready yet
        tabs={tabs}
      />
      {children}
      <MoodSelectorModal />
    </AppBackground>
  );
}
