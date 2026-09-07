'use client';

import { AccountingCurrenciesTable } from '@/components/organisms/accounting/tables/AccountingCurrenciesTable';

export default function CurrencyPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Currencies</h2>
        <p className="mt-1 text-sm text-gray-500">Manage currencies available to this tenant.</p>
      </div>
      <AccountingCurrenciesTable />
    </div>
  );
}
