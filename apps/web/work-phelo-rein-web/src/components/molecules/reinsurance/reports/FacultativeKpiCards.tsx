'use client';

import { Building2, Handshake, FileText, CircleCheck, Wallet, Activity } from 'lucide-react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import type { FacultativeReportSummary } from '@/hooks/reinsurance/useFacultativeReport';

interface FacultativeKpiCardsProps {
  summary: FacultativeReportSummary;
  isLoading: boolean;
}

const countFor = (rows: { key: string; count: number }[] | undefined, ...keys: string[]) =>
  (rows ?? []).filter((r) => keys.includes(r.key)).reduce((sum, r) => sum + r.count, 0);

/** Count-based KPIs for the Facultative report, computed server-side across all filtered rows. */
export function FacultativeKpiCards({ summary, isLoading }: FacultativeKpiCardsProps) {
  const { statusCounts, paymentStatusCounts } = summary;

  const closed = countFor(statusCounts, 'CLOSED');
  const placed = countFor(statusCounts, 'PLACED', 'PARTIALLY_PLACED', 'CLOSING');
  const marketing = countFor(statusCounts, 'DRAFT', 'MARKETING');

  const paid = countFor(paymentStatusCounts, 'Paid');
  const part = countFor(paymentStatusCounts, 'Part Payment');
  const outstanding = countFor(paymentStatusCounts, 'Outstanding', 'Pending');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 shrink-0">
      <KpiCard
        label="Total Placements"
        value={summary.totalOffers}
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
        value={closed}
        icon={CircleCheck}
        iconColor="#16a34a"
        sub={[
          { label: 'Placed', value: placed },
          { label: 'Open', value: marketing },
        ]}
        isLoading={isLoading}
      />
      <KpiCard
        label="Premium Paid"
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
        label="Active"
        value={summary.activeCount ?? 0}
        icon={Activity}
        iconColor="#e11d48"
        sub={[{ label: 'Expired', value: summary.expiredCount ?? 0 }]}
        isLoading={isLoading}
      />
    </div>
  );
}
