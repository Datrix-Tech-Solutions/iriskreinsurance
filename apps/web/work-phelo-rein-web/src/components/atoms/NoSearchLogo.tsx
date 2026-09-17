import { cn } from '@/lib/utils';
import Image from 'next/image';

interface NoSearchLogoProps {
  className?: string;
}

export function NoSearchLogo({ className = '' }: NoSearchLogoProps) {
  return (
    <div className={cn('flex justify-center', className)}>
      <div className="relative w-47.5 aspect-280/90">
        <Image
          src="/NoSearchLogo.png"
          alt="No Search Results"
          fill
          className="object-contain"
          sizes="(max-width: 500px) 120px, 180px"
          priority
        />
      </div>
    </div>
  );
}
