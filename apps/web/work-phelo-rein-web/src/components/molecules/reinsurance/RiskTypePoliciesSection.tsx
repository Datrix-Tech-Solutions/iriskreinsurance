'use client';

import { useState, useMemo } from 'react';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { Badge } from '@/components/atoms/Badge';
import { StatCard } from '@/components/atoms/StatCard';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Facultative, toDisplayStatus } from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

const PAGE_SIZE = 10;

const STATUS_VARIANT_MAP: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  Open: 'warning',
  Closed: 'success',
  Cancelled: 'danger',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null, currency: string | null): string {
  if (val == null) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const POLICY_COLUMNS: Column<Facultative>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '1fr',
    render: (row) => (
      <span className="font-medium text-gray-900">{displayPolicyNumber(row.policyNumber)}</span>
    ),
  },
  {
    key: 'title',
    label: 'Insured',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{row.title}</span>,
  },
  {
    key: 'cedant',
    label: 'Cedant',
    width: '1.5fr',
    render: (row) => <span className="text-gray-600">{row.cedant.name}</span>,
  },
  {
    key: 'premium',
    label: 'Premium',
    width: '1.2fr',
    render: (row) => <span className="text-gray-700">{fmtAmount(row.premium, row.currency)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '110px',
    render: (row) => {
      const display = toDisplayStatus(row.status);
      return <Badge label={display} variant={STATUS_VARIANT_MAP[display] ?? 'neutral'} />;
    },
  },
  {
    key: 'inceptionDate',
    label: 'Period',
    width: '1.2fr',
    render: (row) => (
      <span className="text-gray-500 whitespace-nowrap">
        {fmtDate(row.inceptionDate)} – {fmtDate(row.expiryDate)}
      </span>
    ),
  },
];

interface RiskTypePoliciesSectionProps {
  policies: Facultative[];
  isLoading: boolean;
  tenantSlug: string;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function RiskTypePoliciesSection({
  policies,
  isLoading,
  tenantSlug,
  currentPage,
  totalPages: serverTotalPages,
  onPageChange,
}: RiskTypePoliciesSectionProps) {
  const router = useRouter();
  const [localPage, setLocalPage] = useState(1);
  const page = currentPage ?? localPage;
  const setPage = onPageChange ?? setLocalPage;

  const openCount = policies.filter((p) => toDisplayStatus(p.status) === 'Open').length;
  const closedCount = policies.filter((p) => toDisplayStatus(p.status) === 'Closed').length;

  const brokerageByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of policies) {
      if (p.premium == null || p.currency == null) continue;
      for (const pt of p.participants) {
        if (pt.status !== 'ACCEPTED' && pt.status !== 'CLOSED') continue;
        const share = pt.sharePercent != null ? parseFloat(pt.sharePercent) : null;
        const fee = pt.brokerageFee != null ? parseFloat(pt.brokerageFee) : null;
        if (share == null || fee == null) continue;
        map.set(p.currency, (map.get(p.currency) ?? 0) + p.premium * (share / 100) * (fee / 100));
      }
    }
    return map;
  }, [policies]);

  const brokerageDisplay = useMemo(() => {
    const entries = Array.from(brokerageByCode.entries());
    if (entries.length === 0) return { value: '—', sub: 'Across accepted participants' };
    const [code, amount] = entries[0];
    const formatted = `${code} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return {
      value: formatted,
      sub:
        entries.length > 1
          ? `+${entries.length - 1} more ${entries.length - 1 === 1 ? 'currency' : 'currencies'}`
          : 'Across accepted participants',
    };
  }, [brokerageByCode]);

  const totalPages = serverTotalPages ?? Math.max(1, Math.ceil(policies.length / PAGE_SIZE));
  const paged = serverTotalPages
    ? policies
    : policies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Policies"
          value={policies.length}
          sub="All placements of this type"
        />
        <StatCard label="Open Policies" value={openCount} sub="Active, not yet closed" />
        <StatCard label="Closed Policies" value={closedCount} sub="Fully closed placements" />
        <StatCard
          label="Total Brokerage"
          value={brokerageDisplay.value}
          sub={brokerageDisplay.sub}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Policies</h3>
        <DataTable
          columns={POLICY_COLUMNS}
          data={paged}
          isLoading={isLoading}
          emptyMessage="No policies found for this risk type"
          onRowClick={(row) =>
            router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.id}`)
          }
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>
    </div>
  );
}
