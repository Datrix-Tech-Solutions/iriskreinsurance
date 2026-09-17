import { cn } from '@/lib/utils';
import { AccountType } from '@/types/accounting';

const TYPE_STYLES: Record<AccountType, string> = {
  Asset: 'bg-blue-50 text-blue-700',
  Liability: 'bg-red-50 text-red-700',
  Equity: 'bg-purple-50 text-purple-700',
  Revenue: 'bg-green-50 text-green-700',
  Expense: 'bg-orange-50 text-orange-700',
};

interface AccountTypePillProps {
  type: AccountType;
}

export function AccountTypePill({ type }: AccountTypePillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
        TYPE_STYLES[type],
      )}
    >
      {type}
    </span>
  );
}
