import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { AccountingVendor } from '@/types/accounting';

function fmtBalance(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface VendorOverviewProps {
  vendor: AccountingVendor;
  baseCurrency?: string;
}

export function VendorOverview({ vendor, baseCurrency }: VendorOverviewProps) {
  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Vendor Code" value={vendor.code} />
        <DetailField label="Vendor Name" value={vendor.legalName} />
        <DetailField label="Contact Person" value={vendor.primaryContactName ?? '—'} />
        <DetailField label="Email" value={vendor.email ?? '—'} />
        <DetailField label="Phone" value={vendor.phone ?? '—'} />
        <DetailField label="Currency" value={vendor.currency} />
        <DetailField
          label="Outstanding Balance"
          value={fmtBalance(vendor.balance.baseBalance, baseCurrency ?? vendor.currency)}
        />
        <DetailField
          label="Status"
          value={
            <Badge
              label={vendor.isActive ? 'Active' : 'Inactive'}
              variant={vendor.isActive ? 'success' : 'neutral'}
            />
          }
        />
      </div>
    </CollapsibleOverview>
  );
}
