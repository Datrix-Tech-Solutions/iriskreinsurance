'use client';

import Image from 'next/image';
import { Pencil, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import type { Employee } from '@/types/hr';

interface EmployeeDetailBannerProps {
  employee: Employee;
  hasPendingResignation: boolean;
  onEdit?: () => void;
  onOffboard?: () => void;
  onResign: () => void;
  onResendInvite: () => void;
  isResending?: boolean;
}

export function EmployeeDetailBanner({
  employee,
  hasPendingResignation,
  onEdit,
  onOffboard,
  onResign,
  onResendInvite,
  isResending,
}: EmployeeDetailBannerProps) {
  const name = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase();
  const isPendingInvite = employee.userStatus === 'PENDING_VERIFICATION';
  const isOffboarded = employee.employmentStatus === 'OFFBOARDED';

  return (
    <div className="w-full rounded-card overflow-hidden bg-brand">
      <div className="flex items-center gap-4 px-5 sm:px-6 py-3">
        {employee.avatarUrl ? (
          <Image
            src={employee.avatarUrl}
            alt={initials}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20 shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/10 ring-2 ring-white/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-bold text-white truncate">{name}</h1>
            {!isPendingInvite && <BadgeCheck className="w-4 h-4 text-white/70 shrink-0" />}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
            {employee.jobTitle && (
              <span className="text-xs text-white/60">{employee.jobTitle}</span>
            )}
            {employee.jobTitle && <span className="text-white/30 text-xs">·</span>}
            <span className="text-xs text-white/60">{employee.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {isPendingInvite && (
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

          {hasPendingResignation && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResign}
              className="text-amber-400 border-amber-400 bg-transparent hover:bg-amber-400/10"
            >
              Pending Resignation
            </Button>
          )}

          {!isOffboarded && onEdit && (
            <Button size="sm" onClick={onEdit} className="gap-2">
              Edit
              <Pencil className="w-4 h-4" />
            </Button>
          )}

          {!isOffboarded && onOffboard && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOffboard}
              className="gap-2 text-red-400 border-red-400/60 bg-transparent hover:bg-red-400/10"
            >
              Off-Board
              <Icons.UserMinus className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
