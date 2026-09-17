'use client';

import { useState } from 'react';
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

const SIZE_PX = { sm: 32, md: 40, lg: 56, xl: 96 } as const;

export type AvatarSize = keyof typeof SIZE_PX | number;

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

function textClassFor(px: number): string {
  if (px <= 32) return 'text-xs';
  if (px <= 44) return 'text-sm';
  if (px <= 64) return 'text-base';
  if (px <= 96) return 'text-2xl';
  return 'text-3xl';
}

interface AvatarProps {
  name: string;
  /** Image URL. May be a signed/expiring URL — a load failure falls back to initials. */
  avatarUrl?: string | null;
  /** Keyword (`sm`|`md`|`lg`|`xl`) or an exact pixel size. */
  size?: AvatarSize;
  /** `circle` (default) or `rounded` (squircle). */
  shape?: 'circle' | 'rounded';
  className?: string;
}

/**
 * Employee/user avatar. Renders the image when `avatarUrl` is set and loads
 * successfully, otherwise a colored initials chip. The image is a plain `<img>`
 * so arbitrary storage URLs work without Next image config, and a broken/expired
 * URL (`onError`) transparently drops back to the initials.
 */
export function Avatar({ name, avatarUrl, size = 'lg', shape = 'circle', className }: AvatarProps) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  const initials = getInitials(name);
  const color = pickAvatarColor(name);
  const radius = shape === 'rounded' ? 'rounded-2xl' : 'rounded-full';

  // Track the URL that failed to load; when `avatarUrl` changes this naturally
  // stops matching, so a new image is retried without an effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = !!avatarUrl && failedUrl === avatarUrl;

  if (avatarUrl && !failed) {
    return (
      <div
        className={`shrink-0 overflow-hidden ${radius} ${className ?? ''}`}
        style={{ width: px, height: px }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={name}
          width={px}
          height={px}
          loading="lazy"
          onError={() => setFailedUrl(avatarUrl)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center ${radius} text-white backdrop-blur-sm border border-white/30 ${className ?? ''}`}
      style={{ ...frostedAvatarStyle(color), width: px, height: px }}
    >
      <span className={`${textClassFor(px)} font-semibold leading-none`}>{initials}</span>
    </div>
  );
}
