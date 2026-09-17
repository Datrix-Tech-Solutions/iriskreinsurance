'use client';

import { PlacementEndorsementSummary } from '@/types/reinsurance';
import { ParameterChangesTable } from './ParameterChangesTable';
import { CapacityBar } from './CapacityBar';
import { cardClass } from '@/lib/utils';

interface CapacityRow {
  counterpartyId: string;
  reinsurerName: string;
  share: number;
}

interface EndorsementCapacitySectionProps {
  isDraft: boolean;
  isClosed: boolean;
  original: Record<string, unknown>;
  proposed: Record<string, unknown> | null;
  endorsementSummary: PlacementEndorsementSummary | undefined;
  summaryTargetPercent: number;
  originalPercent: number;
  acceptedCapacityRows: CapacityRow[];
  capacityColorMap: Record<string, string>;
}

export function EndorsementCapacitySection({
  isDraft,
  isClosed,
  original,
  proposed,
  endorsementSummary,
  summaryTargetPercent,
  originalPercent,
  acceptedCapacityRows,
  capacityColorMap,
}: EndorsementCapacitySectionProps) {
  const rawTargetPercent = endorsementSummary?.targetPercent ?? summaryTargetPercent;
  // Once closed the endorsement can no longer gain capacity — a force close can
  // leave acceptedPercent permanently short of the original target, which would
  // otherwise show a stuck partial bar forever. Clamping the target down to
  // whatever was actually accepted makes it read as fully filled, the same way
  // the Distribution List's Placed Capacity bar fills up because the backend
  // shrinks facultativeOffer down to the placed amount on force close.
  const targetPercent =
    isClosed && endorsementSummary
      ? Math.min(rawTargetPercent, endorsementSummary.acceptedPercent)
      : rawTargetPercent;

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Endorsement Summary
      </p>
      {proposed && (
        <div className={cardClass('p-3')}>
          <ParameterChangesTable original={original} proposed={proposed} />
        </div>
      )}
      {!isDraft && endorsementSummary && (
        <div className={cardClass('p-3 flex flex-col gap-3')}>
          <CapacityBar
            acceptedPercent={endorsementSummary.acceptedPercent}
            targetPercent={targetPercent}
            originalPercent={originalPercent}
            rows={acceptedCapacityRows}
            colorMap={capacityColorMap}
            isClosed={isClosed}
          />
        </div>
      )}
    </section>
  );
}
