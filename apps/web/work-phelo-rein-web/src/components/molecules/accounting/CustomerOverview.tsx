import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { AccountingCustomer } from '@/types/accounting';

function fmtBalance(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CustomerOverviewProps {
  customer: AccountingCustomer;
  baseCurrency?: string;
}

export function CustomerOverview({ customer, baseCurrency }: CustomerOverviewProps) {
  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Customer Code" value={customer.code} />
        <DetailField label="Customer Name" value={customer.legalName} />
        <DetailField label="Contact Person" value={customer.primaryContactName ?? '—'} />
        <DetailField label="Email" value={customer.email ?? '—'} />
        <DetailField label="Phone" value={customer.phone ?? '—'} />
        <DetailField label="Currency" value={customer.currency} />
        <DetailField
          label="Outstanding Balance"
          value={fmtBalance(customer.balance.baseBalance, baseCurrency ?? customer.currency)}
        />
        <DetailField
          label="Status"
          value={
            <Badge
              label={customer.isActive ? 'Active' : 'Inactive'}
              variant={customer.isActive ? 'success' : 'neutral'}
            />
          }
        />
      </div>
    </CollapsibleOverview>
  );
}
