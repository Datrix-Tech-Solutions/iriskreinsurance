'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { PlacementShareBreakdown } from '@/components/molecules/reinsurance/PlacementShareBreakdown';
import { CreateDistributionPanel } from '@/components/organisms/reinsurance/panels/CreateDistributionPanel';
import { Treaty } from '@/types/reinsurance';

interface DistributionRow {
  id: string;
}

const COLUMNS: Column<DistributionRow>[] = [
  { key: 'reinsurer', label: 'Reinsurer', width: '2fr' },
  { key: 'share', label: 'Share', width: '1fr' },
  { key: 'overallTreatyShare', label: 'Overall Treaty Share', width: '1.5fr' },
  { key: 'brokerage', label: 'Brokerage', width: '1fr' },
];

interface TreatyDistributionListTabProps {
  treaty: Treaty;
}

export function TreatyDistributionListTab({ treaty }: TreatyDistributionListTabProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <PlacementShareBreakdown
        total={treaty.share}
        totalLabel="Treaty Share"
        entries={[]}
        onAddReinsurers={() => setPanelOpen(true)}
      />

      <div className="mt-4">
        <DataTable
          columns={COLUMNS}
          data={[]}
          emptyMessage="No distribution records yet"
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          noInternalScroll
        />
      </div>

      <CreateDistributionPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onAdd={() => setPanelOpen(false)}
      />
    </>
  );
}
