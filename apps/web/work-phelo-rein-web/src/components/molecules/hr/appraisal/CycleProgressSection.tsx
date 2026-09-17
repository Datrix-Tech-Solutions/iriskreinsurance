'use client';

import { CheckCircle } from 'lucide-react';
import { cardClass } from '@/lib/utils';

interface CycleProgressSectionProps {
  title: string;
  completed: number;
  total: number;
  entityLabel: string;
}

export function CycleProgressSection({
  title,
  completed,
  total,
  entityLabel,
}: CycleProgressSectionProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={cardClass('p-5 flex flex-col gap-3')}>
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-base font-bold text-gray-900">{title}</p>
      </div>

      <p className="text-sm text-gray-500">
        {completed} of {total} {entityLabel} completed
      </p>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-900 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm text-gray-500 shrink-0 w-24 text-right">
          {percentage}% complete
        </span>
      </div>
    </div>
  );
}
