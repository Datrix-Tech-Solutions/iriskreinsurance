'use client';

import { CompanyWordmark} from '@/components/atoms/WorkPheloWordmark';
import { usePublicTenantBranding } from '@/hooks/useTenants';
import { cardClass } from '@/lib/utils';

interface AuthCardProps {
  // form title
  title: string;
  // company name
  tenantSlug?: string;
  // optional description
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthCard({ title, tenantSlug, subtitle, children }: AuthCardProps) {
  const { data: branding, isError } = usePublicTenantBranding(tenantSlug);

  return (
    <div className={cardClass('w-full max-w-sm px-8 py-10')}>
      <div className="text-center mb-3">
        {branding?.tenantName && (
          <p className="text-2xl font-bold text-white/85 mt-2">{branding.tenantName}</p>
        )}
        {isError && (
          <p className="text-sm text-red-500 mt-2">
            We couldn&apos;t find this organization. Please check the link and try again.
          </p>
        )}
      </div>

      <h1 className="text-xl font-semibold text-white/75 text-center mb-3">{title}</h1>
      {subtitle && <p className="-mt-1 mb-4 text-center text-sm text-white/70">{subtitle}</p>}

      {children}

      <p className="mt-3 text-center text-xs text-white/75">
        Powered by <CompanyWordmark className="inline-block h-4 ml-1" />
      </p>
    </div>
  );
}
