'use client';

import { AccountTypeDefinitionsTable } from '@/components/organisms/accounting/tables/AccountTypeDefinitionsTable';

export default function AccountTypePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Account Types</h2>
        <p className="mt-1 text-sm text-gray-500">
          Standard system-controlled categories used for the chart of accounts and financial
          reports.
        </p>
      </div>
      <AccountTypeDefinitionsTable />
    </div>
  );
}
