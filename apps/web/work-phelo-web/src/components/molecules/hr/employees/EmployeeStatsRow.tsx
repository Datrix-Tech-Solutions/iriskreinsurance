import { Users, UserCheck, Clock, CalendarOff } from 'lucide-react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';

interface EmployeeStatsRowProps {
  isLoading: boolean;
  total: number;
  permanent: number;
  probation: number;
  onLeave: number;
}

export function EmployeeStatsRow({
  isLoading,
  total,
  permanent,
  probation,
  onLeave,
}: EmployeeStatsRowProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
      <KpiCard
        label="Total Employees"
        value={total}
        icon={Users}
        iconColor="#6b7280"
        isLoading={isLoading}
      />
      <KpiCard
        label="Permanent Staff"
        value={permanent}
        icon={UserCheck}
        iconColor="#22c55e"
        isLoading={isLoading}
      />
      <KpiCard
        label="On Probation"
        value={probation}
        icon={Clock}
        iconColor="#eab308"
        isLoading={isLoading}
      />
      <KpiCard
        label="On Leave"
        value={onLeave}
        icon={CalendarOff}
        iconColor="#3b82f6"
        isLoading={isLoading}
      />
    </div>
  );
}
