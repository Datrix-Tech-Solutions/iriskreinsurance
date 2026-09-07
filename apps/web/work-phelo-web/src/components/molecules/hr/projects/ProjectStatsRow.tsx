import { ClipboardList, CheckCircle, Layers } from 'lucide-react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';

interface ProjectStatsRowProps {
  isLoading: boolean;
  total: number;
  active: number;
  completed: number;
  planning: number;
}

export function ProjectStatsRow({
  isLoading,
  total,
  active,
  completed,
  planning,
}: ProjectStatsRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
      <KpiCard
        label="Total Projects"
        value={total}
        icon={Layers}
        iconColor="#22c55e"
        isLoading={isLoading}
      />
      <KpiCard
        label="Active Projects"
        value={active}
        icon={ClipboardList}
        iconColor="#3b82f6"
        isLoading={isLoading}
      />
      <KpiCard
        label="Completed"
        value={completed}
        icon={CheckCircle}
        iconColor="#a855f7"
        isLoading={isLoading}
      />
      <KpiCard
        label="In Planning"
        value={planning}
        icon={ClipboardList}
        iconColor="#eab308"
        isLoading={isLoading}
      />
    </div>
  );
}
