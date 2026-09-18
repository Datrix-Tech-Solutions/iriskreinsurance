'use client';

import { DataTable, Column } from '@/components/organisms/shared/DataTable';

interface EndorsementRow {
  id: string;
}

const COLUMNS: Column<EndorsementRow>[] = [
  { key: 'type', label: 'Type', width: '1.5fr' },
  { key: 'effectiveDate', label: 'Effective Date', width: '1.5fr' },
  { key: 'status', label: 'Status', width: '1fr' },
];

export function TreatyEndorsementTab() {
  return (
    <DataTable
      columns={COLUMNS}
      data={[]}
      emptyMessage="No endorsements yet"
      currentPage={1}
      totalPages={1}
      onPageChange={() => {}}
      noInternalScroll
    />
  );
}
