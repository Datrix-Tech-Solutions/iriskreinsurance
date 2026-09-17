'use client';

import { useState } from 'react';
import { FleetsTable, Fleet } from '@/components/molecules/marketing/FleetsTable';
import { AddFleetPanel } from '@/components/organisms/marketing/AddFleetPanel';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

export default function FleetsPage() {
  const [fleets] = useState<Fleet[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const filtered = fleets.filter(
    (f) =>
      f.vehicle.toLowerCase().includes(search.toLowerCase()) ||
      f.regNumber.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <FleetsTable
          data={paginated}
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onAdd={() => setPanelOpen(true)}
        />
      </div>

      <AddFleetPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={(data) => {
          console.log('Add fleet:', data);
          setPanelOpen(false);
        }}
      />
    </>
  );
}
