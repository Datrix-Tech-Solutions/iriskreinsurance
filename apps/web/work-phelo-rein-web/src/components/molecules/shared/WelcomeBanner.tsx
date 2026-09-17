'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Stat {
  label: string;
  value: string | number;
}

interface WelcomeBannerProps {
  userName: string;
  companyName?: string;
  stats?: Stat[];
  className?: string;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function WelcomeBanner({ userName, companyName, stats, className }: WelcomeBannerProps) {
  const greeting = useMemo(
    () => (companyName ? `${getTimeGreeting()}, ${userName}` : `Welcome back, ${userName}!`),
    [companyName, userName],
  );

  const date = useMemo(() => formatDate(), []);

  return (
    <div
      className={cn(
        'w-full rounded-input px-6 py-4 flex items-center justify-between gap-6 overflow-hidden',
        className,
      )}
      style={{ background: 'linear-gradient(to right, var(--brand), var(--brand-gradient-end))' }}
    >
      <div className="flex flex-col gap-0.5">
        {companyName && (
          <span className="text-sm font-semibold text-orange-400">{companyName}</span>
        )}
        <span className="text-lg font-bold text-white">{greeting}</span>
        {!companyName && <span className="text-sm font-medium text-orange-400">{date}</span>}
      </div>

      {stats && stats.length > 0 && (
        <div className="flex items-center gap-8 shrink-0">
          {stats.map((stat, i) => (
            <div key={i} className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-white/60">{stat.label}</span>
              <span className="text-base font-bold text-white">
                {stat.value === 0 || stat.value === '0' ? '—' : stat.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
