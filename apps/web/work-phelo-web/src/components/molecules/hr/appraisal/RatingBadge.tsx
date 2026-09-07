import { cn } from '@/lib/utils';
import { FinalRating } from '@/types/hr';

export const RATING_STYLES: Record<FinalRating, string> = {
  Outstanding: 'bg-green-100 text-green-700',
  'Very Good': 'bg-blue-100 text-blue-700',
  Good: 'bg-cyan-100 text-cyan-700',
  Satisfactory: 'bg-yellow-100 text-yellow-700',
  'Needs Improvement': 'bg-red-100 text-red-700',
};

interface RatingBadgeProps {
  rating?: FinalRating;
}

export function RatingBadge({ rating }: RatingBadgeProps) {
  if (!rating) return <span className="text-gray-400">—</span>;
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', RATING_STYLES[rating])}>
      {rating}
    </span>
  );
}
