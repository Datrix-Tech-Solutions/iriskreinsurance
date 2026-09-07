import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';

interface BillsStatsRowProps {
  isLoading: boolean;
  totalPayables: string;
  overdueBills: number;
  dueThisWeek: number;
  pendingApproval: number;
}

export function BillsStatsRow({
  isLoading,
  totalPayables,
  overdueBills,
  dueThisWeek,
  pendingApproval,
}: BillsStatsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      <KpiCard
        label="Total Payables"
        value={totalPayables}
        icon={Icons.CircleDollarSign}
        iconColor="var(--module-accounting, #2a78d6)"
        isLoading={isLoading}
      />
      <KpiCard
        label="Overdue Bills"
        value={overdueBills}
        icon={Icons.FileWarning}
        iconColor="#e34948"
        isLoading={isLoading}
      />
      <KpiCard
        label="Due This Week"
        value={dueThisWeek}
        icon={Icons.CalendarRange}
        iconColor="#eda100"
        isLoading={isLoading}
      />
      <KpiCard
        label="Pending Approval"
        value={pendingApproval}
        icon={Icons.Clock}
        iconColor="#4a3aa7"
        isLoading={isLoading}
      />
    </div>
  );
}
