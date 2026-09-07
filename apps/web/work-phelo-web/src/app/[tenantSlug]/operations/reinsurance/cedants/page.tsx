'use client';

import { CedantsTable } from '@/components/organisms/reinsurance/tables/CedantsTable';

export default function CedantsPage() {
  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Cedant</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage individual cedants or Insurers</p>
      </div>
      <CedantsTable />
    </div>
  );
}
