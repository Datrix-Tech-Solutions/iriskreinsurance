'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, MoreHorizontal, Pencil } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Avatar } from '@/components/atoms/Avatar';
import { cn } from '@/lib/utils';
import {
  ProfileBannerTabs,
  type ProfileBannerTab,
} from '@/components/molecules/hr/employees/ProfileBannerTabs';
import type { Employee } from '@/types/hr';

interface ProfileBannerProps {
  employee: Employee;
  hasPendingResignation: boolean;
  canEdit: boolean;
  onResign: () => void;
  onEdit: () => void;
  /** When provided, shows a camera badge on the avatar + a "Change photo" menu item. */
  onEditAvatar?: () => void;
  /** HR-management-only actions — omitted on the self-service profile page. */
  onOffboard?: () => void;
  onResendInvite?: () => void;
  isResending?: boolean;
  color?: string | null;
  backgroundImage?: string | null;
  tabs?: ProfileBannerTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
}

export function ProfileBanner({
  employee,
  hasPendingResignation,
  canEdit,
  onResign,
  onEdit,
  onEditAvatar,
  onOffboard,
  onResendInvite,
  isResending,
  color,
  backgroundImage,
  tabs,
  activeTab,
  onTabChange,
}: ProfileBannerProps) {
  const name = `${employee.firstName} ${employee.lastName}`;
  const isOffboarded = employee.employmentStatus === 'OFFBOARDED';
  const isPendingInvite = employee.userStatus === 'PENDING_VERIFICATION';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div
      className="relative w-full rounded-card rounded-t-none bg-brand"
      style={color ? { background: color } : undefined}
    >
      {backgroundImage && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] rounded-t-none"
        >
          <Image
            src={backgroundImage}
            alt=""
            className="h-full w-full object-cover opacity-[0.08] mix-blend-soft-light mask-[linear-gradient(to_bottom,black,transparent)]"
          />
        </div>
      )}

      <div className="relative flex items-end gap-4 px-5 pt-13 pb-3 sm:px-6 sm:pt-17 lg:pt-20">
        
        <div className="relative w-36 shrink-0 self-stretch">
          <div className="absolute left-0 bottom-0 z-10 translate-y-7">
            <div className="relative">
              <Avatar
                name={name}
                avatarUrl={employee.avatarUrl}
                size={144}
                shape="rounded"
                className="ring-2 ring-white/20"
              />
              {onEditAvatar && (
                <button
                  type="button"
                  onClick={onEditAvatar}
                  aria-label="Change profile photo"
                  className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-700 shadow-md ring-1 ring-black/5 transition-colors hover:bg-gray-50"
                >
                  <Camera className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 self-stretch flex flex-col">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white truncate">{name}</h1>
            <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
              <span className="text-xs text-white/60">{employee.email}</span>
              {employee.phone && (
                <>
                  <span className="text-white/30 text-xs">·</span>
                  <span className="text-xs text-white/60">{employee.phone}</span>
                </>
              )}
            </div>
          </div>
          {tabs && tabs.length > 0 && (
            <ProfileBannerTabs
              className="mt-auto translate-y-3 pt-2"
              tabs={tabs}
              activeTab={activeTab ?? ''}
              onTabChange={onTabChange ?? (() => {})}
              accentColor={color}
              maxInline={4}
            />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {isPendingInvite && onResendInvite && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResendInvite}
              isLoading={isResending}
              loadingText="Sending…"
              className="text-white border-white/40 bg-transparent hover:bg-white/10"
            >
              Resend Invite
            </Button>
          )}

          {canEdit && !isOffboarded && (
            <Button size="sm" onClick={onEdit} className="gap-2">
              Edit
              <Pencil className="w-4 h-4" />
            </Button>
          )}

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border bg-transparent transition-colors',
                hasPendingResignation
                  ? 'border-amber-400 text-amber-400 hover:bg-amber-400/10'
                  : 'border-white/40 text-white hover:bg-white/10',
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 min-w-44 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5"
              >
                {onEditAvatar && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onEditAvatar();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Change photo
                  </button>
                )}
                {!isOffboarded && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onResign();
                      setMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-gray-50',
                      hasPendingResignation ? 'text-amber-600' : 'text-red-700',
                    )}
                  >
                    {hasPendingResignation ? 'Pending Resignation' : 'Resign'}
                  </button>
                )}

                {onOffboard && !isOffboarded && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onOffboard();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-sm font-medium text-red-700 transition-colors hover:bg-gray-50"
                  >
                    Off-Board
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
