import { cn, cardClass, waterIconStyle } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value?: number | null;
  icon: React.ReactNode;
  /** Hex color seed for the icon's water-glass circle — defaults to the module color. */
  iconColor?: string;
  className?: string;
}

export function StatCard({ title, value, icon, iconColor, className }: StatCardProps) {
  return (
    <div className={cardClass(cn('p-5 flex flex-col gap-0', className), 'glass')}>
      <div className="flex items-start justify-between">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={waterIconStyle(iconColor ?? 'var(--module-btn-bg, var(--brand))')}
        >
          {icon}
        </div>
      </div>
      <span className="text-xl font-medium text-gray-800">
        {value == null || value === 0 ? '-' : value}
      </span>
    </div>
  );
}
