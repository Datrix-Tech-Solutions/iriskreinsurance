import { cn } from '@/lib/utils';

interface WorkPheloWordmarkProps {
  className?: string;
}

export function WorkPheloWordmark({ className }: WorkPheloWordmarkProps) {
  return (
    <span className={cn('text-xl font-bold tracking-tight', className)}>
      <span className="text-orange-500">WORK</span>
      <span className="text-brand">Phelo</span>
    </span>
  );
}
