// components/FinalRatingCard.tsx
import { cn } from '@/lib/utils';
import type { FinalizedAppraisal } from '@/types/hr';

const RATING_STYLES: Record<string, string> = {
  Outstanding: 'bg-green-100 text-green-700 border-green-200',
  'Very Good': 'bg-blue-100 text-blue-700 border-blue-200',
  Good: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  Satisfactory: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Needs Improvement': 'bg-red-100 text-red-700 border-red-200',
};

interface Props {
  finalized: FinalizedAppraisal;
}

export function FinalRatingCard({ finalized }: Props) {
  return (
    <div
      className={cn(
        'mt-4 border rounded-card p-5 flex flex-col gap-4',
        RATING_STYLES[finalized.finalRating],
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          Overall Performance Rating
        </p>
        <p className="text-lg font-bold">{finalized.finalRating}</p>
        <p className="text-sm opacity-80">Score: {finalized.overallScore}%</p>
      </div>

      {finalized.hrComments && (
        <div className="flex flex-col gap-1 border-t border-current border-opacity-20 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">HR Comments</p>
          <p className="text-sm leading-relaxed">{finalized.hrComments}</p>
        </div>
      )}
    </div>
  );
}
