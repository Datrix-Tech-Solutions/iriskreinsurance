'use client';

import { ExchangeRatesTable } from '@/components/organisms/accounting/tables/ExchangeRatesTable';

export default function ExchangeRatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Exchange Rates</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage effective-dated exchange rates for active tenant currencies.
        </p>
      </div>
      <ExchangeRatesTable />
    </div>
  );
}
