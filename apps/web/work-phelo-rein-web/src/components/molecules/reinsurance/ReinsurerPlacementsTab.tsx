'use client';

import { useState, useMemo } from 'react';
import { FilterChip } from '@/components/atoms/FilterChip';
import {
  ReinsurerPoliciesTable,
  type ReinsurerParticipation,
} from '@/components/molecules/reinsurance/tables/ReinsurerPoliciesTable';

type ParticipationFilter = 'all' | 'accepted' | 'pending' | 'closed' | 'declined';

interface ReinsurerPlacementsTabProps {
  participations: ReinsurerParticipation[];
  isLoading: boolean;
  onView: (id: string, reference: string) => void;
}

export function ReinsurerPlacementsTab({
  participations,
  isLoading,
  onView,
}: ReinsurerPlacementsTabProps) {
  const [filter, setFilter] = useState<ParticipationFilter>('all');

  const counts = useMemo(
    () => ({
      all: participations.length,
      accepted: participations.filter((p) => p.participantStatus === 'ACCEPTED').length,
      pending: participations.filter(
        (p) => p.placementStatus === 'DRAFT' || p.placementStatus === 'MARKETING',
      ).length,
      closed: participations.filter(
        (p) =>
          p.placementStatus === 'PARTIALLY_PLACED' ||
          p.placementStatus === 'PLACED' ||
          p.placementStatus === 'CLOSED',
      ).length,
      declined: participations.filter((p) => p.participantStatus === 'DECLINED').length,
    }),
    [participations],
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case 'accepted':
        return participations.filter((p) => p.participantStatus === 'ACCEPTED');
      case 'pending':
        return participations.filter(
          (p) => p.placementStatus === 'DRAFT' || p.placementStatus === 'MARKETING',
        );
      case 'closed':
        return participations.filter(
          (p) =>
            p.placementStatus === 'PARTIALLY_PLACED' ||
            p.placementStatus === 'PLACED' ||
            p.placementStatus === 'CLOSED',
        );
      case 'declined':
        return participations.filter((p) => p.participantStatus === 'DECLINED');
      default:
        return participations;
    }
  }, [participations, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip
          label="All Offers"
          count={counts.all}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterChip
          label="Accepted"
          count={counts.accepted}
          active={filter === 'accepted'}
          onClick={() => setFilter('accepted')}
        />
        <FilterChip
          label="Pending"
          count={counts.pending}
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
        />
        <FilterChip
          label="Closed"
          count={counts.closed}
          active={filter === 'closed'}
          onClick={() => setFilter('closed')}
        />
        <FilterChip
          label="Declined"
          count={counts.declined}
          active={filter === 'declined'}
          onClick={() => setFilter('declined')}
        />
      </div>

      <ReinsurerPoliciesTable
        key={filter}
        data={filtered}
        isLoading={isLoading}
        onRowClick={(id) => {
          const participation = participations.find((p) => p.id === id);
          if (participation) onView(participation.id, participation.reference);
        }}
      />
    </div>
  );
}
