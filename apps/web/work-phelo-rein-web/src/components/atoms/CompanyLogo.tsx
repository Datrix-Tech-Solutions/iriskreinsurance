'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { WorkPheloWordmark } from '@/components/atoms/WorkPheloWordmark';
import { usePublicTenantBranding } from '@/hooks/useTenants';
import { useAuthStore } from '@/store/auth.store';

interface CompanyLogoProps {
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
  priority?: boolean;
}

// Super Admin routes (/dashboard, /platform) must never show a tenant's uploaded logo.
function isSuperAdminRoute(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/platform' ||
    pathname.startsWith('/platform/')
  );
}

export function CompanyLogo({ className, style, width = 80, height = 50 }: CompanyLogoProps) {
  const pathname = usePathname();
  const isSuperAdmin = isSuperAdminRoute(pathname ?? '');
  const { user } = useAuthStore();
  const { data: branding } = usePublicTenantBranding(isSuperAdmin ? undefined : user?.tenantSlug);
  const [failed, setFailed] = useState(false);

  const logoSrc = branding?.appLogoUrl;

  if (isSuperAdmin || !logoSrc || failed) {
    return <WorkPheloWordmark className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoSrc}
      alt="Company logo"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: 'contain', ...style, width, height }}
      onError={() => setFailed(true)}
    />
  );
}
