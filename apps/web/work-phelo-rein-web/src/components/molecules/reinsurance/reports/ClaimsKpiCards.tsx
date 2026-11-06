'use client';

import { Building2, Handshake, FileWarning, FolderOpen, Hourglass, Wallet } from 'lucide-react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import type { ClaimsReportSummary } from '@/hooks/reinsurance/useClaimsReport';

interface ClaimsKpiCardsProps {
  summary: ClaimsReportSummary;
  isLoading: boolean;
}

/** Count-based KPIs for the Claims report, computed server-side across all filtered claims. */
export function ClaimsKpiCards({ summary, isLoading }: ClaimsKpiCardsProps) {
  const recovery = summary.recoveryCounts ?? { outstanding: 0, part: 0, full: 0 };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 shrink-0">
      <KpiCard
        label="Total Claims"
        value={summary.claimCount ?? 0}
        icon={FileWarning}
        iconColor="#e11d48"
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
        label="Open"
        value={summary.openCount ?? 0}
        icon={FolderOpen}
        iconColor="#2563eb"
        sub={[
          { label: 'Notification', value: summary.notificationCount ?? 0 },
          { label: 'Closed', value: summary.closedCount ?? 0 },
        ]}
        isLoading={isLoading}
      />
      <KpiCard
        label="Pending"
        value={summary.pendingCount ?? 0}
        icon={Hourglass}
        iconColor="#d97706"
        sub={[{ label: 'Finalized', value: summary.finalizedCount ?? 0 }]}
        isLoading={isLoading}
      />
      <KpiCard
        label="Recovered"
        value={recovery.full}
        icon={Wallet}
        iconColor="#16a34a"
        sub={[
          { label: 'Part', value: recovery.part },
          { label: 'Unpaid', value: recovery.outstanding },
        ]}
        isLoading={isLoading}
      />
    </div>
  );
}
