'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { AllProspectsTable, Prospect } from '@/components/molecules/marketing/AllProspectsTable';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

export default function AllProspectsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const [prospects] = useState<Prospect[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = prospects.filter((p) =>
    p.prospectName.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleRowClick(row: Prospect) {
    router.push(
      `/${tenantSlug}/marketing/prospects/all/${row.id}?name=${encodeURIComponent(row.prospectName)}`,
    );
  }

  return (
    <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
      <AllProspectsTable
        data={paginated}
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={handleRowClick}
        onAdd={() => router.push(`/${tenantSlug}/marketing/prospects/all/new`)}
      />
    </div>
  );
}
