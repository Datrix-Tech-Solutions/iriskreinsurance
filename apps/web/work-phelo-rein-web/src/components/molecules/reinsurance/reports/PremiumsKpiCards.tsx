'use client';

import { Building2, Handshake, FileText, CircleCheck, Wallet, Landmark } from 'lucide-react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import type { PremiumsReportSummary } from '@/hooks/reinsurance/usePremiumsReport';

interface PremiumsKpiCardsProps {
  summary: PremiumsReportSummary;
  isLoading: boolean;
}

const countFor = (rows: { key: string; count: number }[] | undefined, ...keys: string[]) =>
  (rows ?? []).filter((r) => keys.includes(r.key)).reduce((sum, r) => sum + r.count, 0);

/** Count-based KPIs for the Premiums report, computed server-side across all filtered rows. */
export function PremiumsKpiCards({ summary, isLoading }: PremiumsKpiCardsProps) {
  const paid = countFor(summary.paymentStatusCounts, 'Paid');
  const part = countFor(summary.paymentStatusCounts, 'Part Payment');
  const outstanding = countFor(summary.paymentStatusCounts, 'Outstanding', 'Pending');
  const settlement = summary.settlementCounts ?? { paid: 0, part: 0, outstanding: 0 };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 shrink-0">
      <KpiCard
        label="Total Placements"
        value={summary.placementCount ?? 0}
        icon={FileText}
        iconColor="#2563eb"
        isLoading={isLoading}
      />
      <KpiCard
        label="Cedants"
        value={summary.cedantCount ?? 0}
        icon={Building2}
        iconColor="#7c3aed"
        isLoading={isLoading}
      />
      <KpiCard
        label="Reinsurers"
        value={summary.reinsurerCount ?? 0}
        icon={Handshake}
        iconColor="#0891b2"
        isLoading={isLoading}
      />
      <KpiCard
        label="Closed"
        value={summary.closedCount ?? 0}
        icon={CircleCheck}
        iconColor="#16a34a"
        sub={[{ label: 'Open', value: summary.openCount ?? 0 }]}
        isLoading={isLoading}
      />
      <KpiCard
        label="Cedant Payments"
        value={paid}
        icon={Wallet}
        iconColor="#d97706"
        sub={[
          { label: 'Part', value: part },
          { label: 'Outstanding', value: outstanding },
        ]}
        isLoading={isLoading}
      />
      <KpiCard
        label="Reinsurer Settlement"
        value={settlement.paid}
        icon={Landmark}
        iconColor="#e11d48"
        sub={[
          { label: 'Part', value: settlement.part },
          { label: 'Outstanding', value: settlement.outstanding },
        ]}
        isLoading={isLoading}
      />
    </div>
  );
}
