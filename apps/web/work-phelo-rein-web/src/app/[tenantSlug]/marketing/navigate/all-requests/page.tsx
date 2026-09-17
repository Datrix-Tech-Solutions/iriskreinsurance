'use client';

import { useState } from 'react';
import { RequestsTable, TransportRequest } from '@/components/molecules/marketing/RequestsTable';
import { AddRequestPanel } from '@/components/organisms/marketing/AddRequestPanel';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

export default function AllRequestsPage() {
  const [requests] = useState<TransportRequest[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const filtered = requests.filter(
    (r) =>
      r.staff.toLowerCase().includes(search.toLowerCase()) ||
      r.location.toLowerCase().includes(search.toLowerCase()) ||
      r.transportOfficer.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <RequestsTable
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

      <AddRequestPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSendRequest={() => setPanelOpen(false)}
        onCancel={() => setPanelOpen(false)}
      />
    </>
  );
}
