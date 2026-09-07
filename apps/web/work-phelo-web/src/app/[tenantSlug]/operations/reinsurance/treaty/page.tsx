'use client';

import { TreatiesTable } from '@/components/organisms/reinsurance/tables/TreatiesTable';

export default function TreatyPage() {
  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Treaties</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage proportional and non-proportional treaty arrangements
        </p>
      </div>

      <TreatiesTable />
    </div>
  );
}
