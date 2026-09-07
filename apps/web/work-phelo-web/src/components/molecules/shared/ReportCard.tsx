'use client';

import { cn, glassStrongClass } from '@/lib/utils';

interface ReportStat {
  label: string;
  value: string;
}

interface ReportCardProps {
  icon: React.ReactNode;
  iconClassName?: string;
  title: string;
  description: string;
  stats?: ReportStat[];
  onClick: () => void;
  className?: string;
}

export function ReportCard({
  icon,
  iconClassName,
  title,
  description,
  stats,
  onClick,
  className,
}: ReportCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={glassStrongClass(
        cn(
          'group w-full text-left rounded-2xl border border-gray-100 p-7 flex flex-col gap-5',
          'transition-all duration-200 ease-out',
          'hover:-translate-y-1 hover:shadow-lg hover:shadow-white-200/80',
          className,
        ),
        'none',
      )}
    >
      {/* Icon + Title */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <div
            className={cn(
              'w-10 h-10 rounded-3xl flex items-center justify-center shrink-0',
              iconClassName ?? 'bg-gray-100 text-gray-700',
            )}
          >
            {icon}
          </div>
        </div>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      {/* Stats row */}
      {stats && stats.length > 0 && (
        <div
          className="w-full bg-gray-50 rounded-xl px-4 py-3 grid gap-4"
          style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">{stat.label}</span>
              <span className="text-sm font-semibold text-gray-900">{stat.value}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
