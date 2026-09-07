'use client';

import { usePlacementEndorsements } from '@/hooks';

interface EndorsedReferencePillProps {
  id: string;
  reference: string;
  endorsementCount?: number;
}

export function EndorsedReferencePill({
  id,
  reference,
  endorsementCount,
}: EndorsedReferencePillProps) {
  const shouldFetch = endorsementCount === undefined;
  const { data: endorsements = [] } = usePlacementEndorsements(id, {
    enabled: shouldFetch,
  });
  const count = endorsementCount ?? endorsements.filter((e) => e.status !== 'VOID').length;

  return (
    <div className="relative inline-flex group">
      <span className="inline-flex items-center px-3 py-1 rounded-full border border-blue-200/60 text-xs font-medium text-blue-700 backdrop-blur-md bg-blue-50/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] whitespace-nowrap transition-all duration-200 group-hover:bg-blue-50/80 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_12px_rgba(32,129,216,0.12)]">
        {reference}
        {count > 0 && (
          <span className="inline-block max-w-0 overflow-hidden group-hover:max-w-25 transition-[max-width] opacity-0 group-hover:opacity-100 duration-200 group-hover:ml-1.5 text-green-600 font-semibold whitespace-nowrap">
            · {count} endorsement{count > 1 ? 's' : ''}
          </span>
        )}
      </span>
      {count > 0 && (
        <div className="absolute -top-1 right-0 size-2.5 rounded-full bg-green-500 pointer-events-none " />
      )}
    </div>
  );
}
