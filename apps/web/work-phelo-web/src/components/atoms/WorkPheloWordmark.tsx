import { cn } from '@/lib/utils';

interface WorkPheloWordmarkProps {
  className?: string;
}

export function WorkPheloWordmark({ className }: WorkPheloWordmarkProps) {
  return (
    <span className={cn('text-xl font-bold tracking-tight', className)}>
      <span className="text-orange-500">Work</span>
      <span className="text-brand">Phelo</span>
    </span>
  );
}


interface CompanyWordmarkProps {
  className?: string;
}

export function CompanyWordmark({ className }: CompanyWordmarkProps) {
  return (
    <span className={cn('text-xl font-bold tracking-tight', className)}>
      <span className="text-gray-600">Datrix</span>
      <span className="text-xs text-brand">tech</span>
    </span>
  );
}
