'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';

interface ClosingRow {
  id: string;
}

const COLUMNS: Column<ClosingRow>[] = [
  { key: 'reinsurer', label: 'Reinsurance Company', width: '1.5fr' },
  { key: 'premium', label: 'Premium', width: '1fr' },
  { key: 'claims', label: 'Claims', width: '1fr' },
  { key: 'signedShare', label: 'Signed Share', width: '1fr' },
  { key: 'brokerage', label: 'Brokerage', width: '1fr' },
  { key: 'signedGrossPremium', label: 'Signed Net Premium', width: '1fr' },
];

export function TreatyPlacementClosingsTab() {
  return (
    <DataTable
      columns={COLUMNS}
      data={[]}
      emptyMessage="No closings yet"
      currentPage={1}
      totalPages={1}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
