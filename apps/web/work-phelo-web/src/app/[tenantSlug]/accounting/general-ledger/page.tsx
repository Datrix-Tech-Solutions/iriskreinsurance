'use client';

import { GeneralLedgerTable } from '@/components/organisms/accounting/tables/GeneralLedgerTable';

export default function GeneralLedgerPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">General Ledger</h2>
      </div>

      <GeneralLedgerTable />
    </div>
  );
}
