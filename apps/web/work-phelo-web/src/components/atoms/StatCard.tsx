import { ReactNode } from 'react';
import { cardClass } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className={cardClass('flex flex-col gap-1.5 p-5', 'glass')}>
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}
