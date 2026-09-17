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

interface CedantOverviewProps {
  cedant: Counterparty;
}

export function CedantOverview({ cedant }: CedantOverviewProps) {
  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Name" value={cedant.name} />
        <DetailField label="Email" value={cedant.email ?? '—'} />
        <DetailField label="Phone" value={cedant.phone ?? '—'} />
        <DetailField label="Address" value={formatCity(cedant.addresses)} />
        <DetailField label="Territory" value={formatTerritory(cedant.addresses)} />
        {cedant.notes && <DetailField label="Notes" value={cedant.notes} />}
      </div>
    </CollapsibleOverview>
  );
}
