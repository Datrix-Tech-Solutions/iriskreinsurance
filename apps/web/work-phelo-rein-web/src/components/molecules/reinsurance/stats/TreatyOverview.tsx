import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { TreatyStatusBadge } from '@/components/molecules/reinsurance/TreatyStatusBadge';
import { Treaty } from '@/types/reinsurance';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface TreatyOverviewProps {
  treaty: Treaty;
}

export function TreatyOverview({ treaty }: TreatyOverviewProps) {
  return (
    <CollapsibleOverview headerExtra={<TreatyStatusBadge status={treaty.status} />}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Treaty Name" value={treaty.name} />
        <DetailField label="Type" value={treaty.type} />
        <DetailField label="Class of Business" value={treaty.classofBusiness} />
        <DetailField label="Cedant" value={treaty.cedant} />
        <DetailField label="Share (%)" value={`${treaty.share}%`} />
        <DetailField label="Accounting Arrangement" value={treaty.accountingArrangement} />
        <DetailField
          label="Period"
          value={`${fmtDate(treaty.periodStart)} – ${fmtDate(treaty.periodEnd)}`}
        />
        <DetailField label="Year" value={treaty.year} />
      </div>
    </CollapsibleOverview>
  );
}
