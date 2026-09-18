import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { Badge } from '@/components/atoms/Badge';
import { AccountClassification, GLAccountCategory } from '@/types/accounting';

const CATEGORY_LABELS: Record<GLAccountCategory, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
};

interface ClassificationOverviewProps {
  account: AccountClassification;
}

export function ClassificationOverview({ account }: ClassificationOverviewProps) {
  return (
    <CollapsibleOverview>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
        <DetailField label="Account Name" value={account.name} />
        <DetailField label="Account Type" value={CATEGORY_LABELS[account.category]} />
        <DetailField label="Account Code" value={account.code} />
        <DetailField
          label="Status"
          value={
            <Badge
              label={account.isActive ? 'Active' : 'Inactive'}
              variant={account.isActive ? 'success' : 'neutral'}
            />
          }
        />
      </div>
    </CollapsibleOverview>
  );
}
