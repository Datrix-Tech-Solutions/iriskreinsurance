import Image from 'next/image';
import { frostedAvatarStyle } from '@/lib/utils';

// Same color identities used across the app (violet, blue, emerald, orange, pink, teal, amber, red).
const AVATAR_COLORS = [
  '#8b5cf6', // violet-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
];

const SIZES = {
  sm: { box: 'w-8 h-8', text: 'text-xs', px: 32 },
  md: { box: 'w-10 h-10', text: 'text-sm', px: 40 },
  lg: { box: 'w-14 h-14', text: 'text-sm', px: 56 },
  xl: { box: 'w-24 h-24', text: 'text-2xl', px: 96 },
} as const;

export type AvatarSize = keyof typeof SIZES;

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function pickAvatarColor(name: string): string {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ name, avatarUrl, size = 'lg', className }: AvatarProps) {
  const { box, text, px } = SIZES[size];
  const initials = getInitials(name);
  const color = pickAvatarColor(name);

  if (avatarUrl) {
    return (
      <div className={`${box} rounded-full overflow-hidden shrink-0 ${className ?? ''}`}>
        <Image
          src={avatarUrl}
          alt={name}
          width={px}
          height={px}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${box} rounded-full flex items-center justify-center shrink-0 text-white backdrop-blur-sm border border-white/30 ${className ?? ''}`}
      style={frostedAvatarStyle(color)}
    >
      <span className={`${text} font-semibold`}>{initials}</span>
    </div>
  );
}
