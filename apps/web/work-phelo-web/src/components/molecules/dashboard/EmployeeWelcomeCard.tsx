'use client';

import { getGreeting } from '@/lib/formatters';
import { cardClass } from '@/lib/utils';
import { Avatar } from '@/components/atoms/Avatar';

interface EmployeeWelcomeCardProps {
  fullName: string;
  avatarUrl?: string | null;
}

export function EmployeeWelcomeCard({ fullName, avatarUrl }: EmployeeWelcomeCardProps) {
  return (
    <div className={cardClass('w-full px-5 py-3 flex items-center gap-4 min-w-0 shrink-0')}>
      <Avatar
        name={fullName}
        avatarUrl={avatarUrl}
        size={96}
        className="-my-4 translate-y-3"
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500">{getGreeting()}</p>
        <h1 className="text-xl font-bold text-(--module-btn-bg,var(--color-brand)) truncate">
          {fullName}
        </h1>
      </div>
    </div>
  );
}
