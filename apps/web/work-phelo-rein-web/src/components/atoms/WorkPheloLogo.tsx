import { cn } from '@/lib/utils';
import { CompanyLogo } from '@/components/atoms/CompanyLogo';
import { WorkPheloWordmark } from '@/components/atoms/WorkPheloWordmark';

interface WorkPheloLogoProps {
  className?: string;
  variant?: 'text' | 'image';
}

export function WorkPheloLogo({ className, variant = 'text' }: WorkPheloLogoProps) {
  if (variant === 'image') {
    return <CompanyLogo className={cn('object-fill', className)} />;
  }

  return <WorkPheloWordmark className={className} />;
}
