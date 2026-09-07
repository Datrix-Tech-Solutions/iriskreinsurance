'use client';

import Image from 'next/image';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import type { Employee } from '@/types/hr';

interface ProfileBannerProps {
  employee: Employee;
  hasPendingResignation: boolean;
  canEdit: boolean;
  onResign: () => void;
  onEdit: () => void;
}

export function ProfileBanner({
  employee,
  hasPendingResignation,
  canEdit,
  onResign,
  onEdit,
}: ProfileBannerProps) {
  const name = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase();

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

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onResign}
            className={
              hasPendingResignation
                ? 'text-amber-400 border-amber-400 bg-transparent hover:bg-amber-400/10'
                : 'text-white border-white/40 bg-transparent hover:bg-white/10'
            }
          >
            {hasPendingResignation ? 'Pending Resignation' : 'Resign'}
          </Button>
          {canEdit && (
            <Button size="sm" onClick={onEdit} className="gap-2">
              Edit
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
