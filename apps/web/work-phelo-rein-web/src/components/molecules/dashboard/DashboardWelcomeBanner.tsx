'use client';

import { getGreeting } from '@/lib/formatters';

interface DashboardWelcomeBannerProps {
  tenantName: string;
  fullName: string;
  department?: string;
  branch?: string;
}

export function DashboardWelcomeBanner({
  tenantName,
  fullName,
  department,
  branch,
}: DashboardWelcomeBannerProps) {
  return (
    <div
      className="rounded-card px-8 py-5 flex items-center justify-between shrink-0"
      style={{ background: 'linear-gradient(to right, var(--brand), var(--brand-gradient-end))' }}
    >
      <div>
        <p className="text-sm font-semibold text-orange-400">{tenantName}</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">
          {getGreeting()}, {fullName}
        </h1>
        {(department || branch) && (
          <p className="text-sm text-blue-200 mt-1">
            {[department, branch].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
