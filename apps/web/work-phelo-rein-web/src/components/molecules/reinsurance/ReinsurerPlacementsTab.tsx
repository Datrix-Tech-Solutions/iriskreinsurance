'use client';

import { useState } from 'react';
import { FilterChip } from '@/components/atoms/FilterChip';
import {
  ReinsurerPoliciesTable,
  type ReinsurerParticipation,
} from '@/components/molecules/reinsurance/tables/ReinsurerPoliciesTable';
import { useReinsurerPlacementsWorklist } from '@/hooks';
import { ReinsurerPlacementFilter } from '@/types/reinsurance';

type ParticipationFilter = ReinsurerPlacementFilter;

interface ReinsurerPlacementsTabProps {
  reinsurerId: string;
  onView: (id: string, reference: string) => void;
}

export function ReinsurerPlacementsTab({ reinsurerId, onView }: ReinsurerPlacementsTabProps) {
  const [filter, setFilter] = useState<ParticipationFilter>('all');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useReinsurerPlacementsWorklist({
    reinsurerId,
    filter,
    page,
    limit: 10,
  });
  const counts = data?.summary ?? { all: 0, accepted: 0, pending: 0, closed: 0, declined: 0 };
  const rows: ReinsurerParticipation[] = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip
          label="All Offers"
          count={counts.all}
          active={filter === 'all'}
          onClick={() => {
            setFilter('all');
            setPage(1);
          }}
        />
        <FilterChip
          label="Accepted"
          count={counts.accepted}
          active={filter === 'accepted'}
          onClick={() => {
            setFilter('accepted');
            setPage(1);
          }}
        />
        <FilterChip
          label="Pending"
          count={counts.pending}
          active={filter === 'pending'}
          onClick={() => {
            setFilter('pending');
            setPage(1);
          }}
        />
        <FilterChip
          label="Closed"
          count={counts.closed}
          active={filter === 'closed'}
          onClick={() => {
            setFilter('closed');
            setPage(1);
          }}
        />
        <FilterChip
          label="Declined"
          count={counts.declined}
          active={filter === 'declined'}
          onClick={() => {
            setFilter('declined');
            setPage(1);
          }}
        />
      </div>

      <ReinsurerPoliciesTable
        key={filter}
        data={rows}
        isLoading={isLoading}
        onRowClick={(id) => {
          const participation = rows.find((p) => p.id === id);
          if (participation) onView(participation.id, participation.reference);
        }}
        currentPage={data?.meta.page ?? page}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={setPage}
      />
    </div>
  );
}
