import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';

interface AccountsReceivableStatsRowProps {
  isLoading: boolean;
  totalReceivables: string;
  overdueInvoices: number;
  dueThisWeek: number;
  collectedMtd: string;
}

export function AccountsReceivableStatsRow({
  isLoading,
  totalReceivables,
  overdueInvoices,
  dueThisWeek,
  collectedMtd,
}: AccountsReceivableStatsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      <KpiCard
        label="Total Receivables"
        value={totalReceivables}
        icon={Icons.CircleDollarSign}
        iconColor="var(--module-accounting, #2a78d6)"
        isLoading={isLoading}
      />
      <KpiCard
        label="Overdue Invoices"
        value={overdueInvoices}
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
        label="Collected (MTD)"
        value={collectedMtd}
        icon={Icons.CircleCheck}
        iconColor="#1baf7a"
        isLoading={isLoading}
      />
    </div>
  );
}
