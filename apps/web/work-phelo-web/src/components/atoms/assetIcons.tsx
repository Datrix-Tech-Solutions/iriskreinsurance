import {
  Armchair,
  Box,
  CarFront,
  KeyRound,
  Laptop,
  Monitor,
  Printer,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AssetType =
  | 'LAPTOP'
  | 'PHONE'
  | 'TABLET'
  | 'PRINTER'
  | 'MONITOR'
  | 'VEHICLE'
  | 'FURNITURE'
  | 'SOFTWARE_LICENSE'
  | 'OTHER';

interface AssetTypeIconProps {
  type: AssetType;
  size?: 'sm' | 'md';
  className?: string;
}

export function AssetTypeIcon({ type, size = 'md', className }: AssetTypeIconProps) {
  const iconSize = size === 'sm' ? 'w-5 h-5' : 'w-10 h-10';
  const baseClasses = cn(iconSize, 'text-brand', className);

  switch (type) {
    case 'LAPTOP':
      return <Laptop className={baseClasses} />;

    case 'PHONE':
      return <Smartphone className={baseClasses} />;

    case 'TABLET':
      return <Tablet className={baseClasses} />;

    case 'MONITOR':
      return <Monitor className={baseClasses} />;

    case 'PRINTER':
      return <Printer className={baseClasses} />;

    case 'VEHICLE':
      return <CarFront className={baseClasses} />;

    case 'FURNITURE':
      return <Armchair className={baseClasses} />;

    case 'SOFTWARE_LICENSE':
      return <KeyRound className={baseClasses} />;

    default:
      return <Box className={baseClasses} />;
  }
}
