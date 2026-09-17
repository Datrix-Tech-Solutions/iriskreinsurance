import { Package, UserCheck, CheckCircle, Wrench, Archive } from 'lucide-react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';

interface AssetStatsRowProps {
  isLoading: boolean;
  total: number;
  assigned: number;
  available: number;
  maintenance: number;
  retired: number;
}

export function AssetStatsRow({
  isLoading,
  total,
  assigned,
  available,
  maintenance,
  retired,
}: AssetStatsRowProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
      <KpiCard
        label="Total Assets"
        value={total}
        icon={Package}
        iconColor="#6b7280"
        isLoading={isLoading}
      />
      <KpiCard
        label="Assigned"
        value={assigned}
        icon={UserCheck}
        iconColor="#3b82f6"
        isLoading={isLoading}
      />
      <KpiCard
        label="Available"
        value={available}
        icon={CheckCircle}
        iconColor="#22c55e"
        isLoading={isLoading}
      />
      <KpiCard
        label="Under Maintenance"
        value={maintenance}
        icon={Wrench}
        iconColor="#eab308"
        isLoading={isLoading}
      />
      <KpiCard
        label="Retired"
        value={retired}
        icon={Archive}
        iconColor="#ef4444"
        isLoading={isLoading}
      />
    </div>
  );
}
