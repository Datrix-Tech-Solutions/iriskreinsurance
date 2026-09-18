import { cn } from '@/lib/utils';
import { SectionType, SectionResponse } from '@/types/hr';

interface Props {
  type: SectionType;
  response?: SectionResponse;
}

export function SectionAnswer({ type, response }: Props) {
  if (!response) return <span className="text-gray-400 text-sm italic">No response</span>;

  if (type === 'YesNo') {
    return (
      <span
        className={cn(
          'px-2.5 py-1 rounded-full text-xs font-semibold',
          response.yesNo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
        )}
      >
        {response.yesNo ? 'Yes' : 'No'}
      </span>
    );
  }

  if (type === 'RatingScale') {
    return <span className="text-sm font-semibold text-gray-900">{response.rating ?? '—'}</span>;
  }

  return (
    <p className="text-sm text-gray-700 leading-relaxed">
      {response.comment || <span className="text-gray-400 italic">No comment</span>}
    </p>
  );
}
