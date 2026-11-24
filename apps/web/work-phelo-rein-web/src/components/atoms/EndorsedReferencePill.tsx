'use client';

import { cn } from '@/lib/utils';
import { usePlacementEndorsements } from '@/hooks';
import { useState } from 'react';

interface EndorsedReferencePillProps {
  id: string;
  reference: string;
  endorsementCount?: number;
  /** Overrides the pill's default text-xs sizing (e.g. for denser report tables). */
  textClassName?: string;
  /** Reports only need this supplementary count when the reference is inspected. */
  deferFetchUntilInteraction?: boolean;
}

export function EndorsedReferencePill({
  id,
  reference,
  endorsementCount,
  textClassName,
  deferFetchUntilInteraction = false,
}: EndorsedReferencePillProps) {
  const [requestedPlacementId, setRequestedPlacementId] = useState<string | null>(null);
  const deferred = deferFetchUntilInteraction && endorsementCount === undefined;
  const shouldFetch = endorsementCount === undefined && (!deferred || requestedPlacementId === id);
  const {
    data: endorsements,
    isFetching,
    isError,
  } = usePlacementEndorsements(id, {
    enabled: shouldFetch,
  });
  const count = endorsementCount ?? endorsements?.filter((e) => e.status !== 'VOID').length;
  const hasEndorsements = count !== undefined && count > 0;
  const requestEndorsements = deferred ? () => setRequestedPlacementId(id) : undefined;

  return (
    <div
      className="relative inline-flex max-w-full group"
      onPointerEnter={requestEndorsements}
      onFocus={requestEndorsements}
      tabIndex={deferred ? 0 : undefined}
      aria-busy={deferred && isFetching ? true : undefined}
      title={
        deferred && isError
          ? 'Endorsement information could not be loaded. Open the placement for details.'
          : undefined
      }
    >
      <span
        className={cn(
          'inline-flex items-center px-3 py-1 rounded-full border border-blue-200/60 text-xs font-medium text-blue-700 backdrop-blur-md bg-blue-50/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] break-words transition-all duration-200 group-hover:bg-blue-50/80 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_12px_rgba(32,129,216,0.12)]',
          textClassName,
        )}
      >
        {reference}
        {hasEndorsements && (
          <span className="inline-block max-w-0 overflow-hidden group-hover:max-w-25 group-focus:max-w-25 transition-[max-width] opacity-0 group-hover:opacity-100 group-focus:opacity-100 duration-200 group-hover:ml-1.5 group-focus:ml-1.5 text-green-600 font-semibold whitespace-nowrap">
            · {count} endorsement{count > 1 ? 's' : ''}
          </span>
        )}
      </span>
      {hasEndorsements && (
        <div className="absolute -top-1 right-0 size-2.5 rounded-full bg-green-500 pointer-events-none " />
      )}
    </div>
  );
}
