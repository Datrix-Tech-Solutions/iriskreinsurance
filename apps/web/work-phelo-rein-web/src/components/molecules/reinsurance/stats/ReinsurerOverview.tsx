'use client';

import { DetailField } from '@/components/atoms/DetailField';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { Counterparty } from '@/types/reinsurance';
import { codeToCountry } from '@/lib/geo';

function formatTerritory(addresses: Counterparty['addresses']): string {
  const primary = addresses.find((a) => a.isPrimary) ?? addresses[0];
  if (!primary) return '—';
  const country = codeToCountry(primary.country);
  return primary.state ? `${primary.state}, ${country}` : country;
}

function formatCity(addresses: Counterparty['addresses']): string {
  const primary = addresses.find((a) => a.isPrimary) ?? addresses[0];
  return primary?.city ?? '—';
}

interface ReinsurerOverviewProps {
  reinsurer: Counterparty;
  headerExtra?: React.ReactNode;
}

export function ReinsurerOverview({ reinsurer, headerExtra }: ReinsurerOverviewProps) {
  return (
    <CollapsibleOverview headerExtra={headerExtra}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Name" value={reinsurer.name} />
        <DetailField label="Email" value={reinsurer.email ?? '—'} />
        <DetailField label="Phone" value={reinsurer.phone ?? '—'} />
        <DetailField
          label="Brokerage Fee"
          value={reinsurer.brokerageFee != null ? `${reinsurer.brokerageFee}%` : '—'}
        />
        <DetailField label="Address" value={formatCity(reinsurer.addresses)} />
        <DetailField label="Territory" value={formatTerritory(reinsurer.addresses)} />
        {reinsurer.notes && <DetailField label="Notes" value={reinsurer.notes} />}
      </div>
    </CollapsibleOverview>
  );
}
