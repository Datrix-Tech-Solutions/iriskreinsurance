import { cn } from '@/lib/utils';
import { StatusBadge } from '../../shared/StatusBadge';

interface Props {
  title: string;
  status?: string;
  children: React.ReactNode;
  accent?: string;
}

export function ResponseColumn({ title, status, children, accent }: Props) {
  return (
    <div className={cn('flex flex-col gap-5 flex-1 min-w-0', accent)}>
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {status && <StatusBadge status={status} />}
      </div>
      {children}
    </div>
  );
}
