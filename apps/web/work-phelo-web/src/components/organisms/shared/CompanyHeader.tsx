'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useApproveTenant, useDeactivateTenant, useDeleteTenant } from '@/hooks/useTenants';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { cardClass } from '@/lib/utils';

interface CompanyHeaderProps {
  id: string;
  name: string;
  slug: string;
  status: string;
  onResendInvite?: () => void;
  isResendingInvite?: boolean;
}

export function CompanyHeader({
  id,
  name,
  slug,
  status,
  onResendInvite,
  isResendingInvite,
}: CompanyHeaderProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateTenant();
  const { mutate: activate, isPending: isActivating } = useApproveTenant();
  const { mutate: deleteTenant, isPending: isDeleting } = useDeleteTenant();

  const invalidateTenant = () => queryClient.invalidateQueries({ queryKey: ['tenant', id] });

  const isSuspended = status === 'SUSPENDED';
  const workspaceUrl = `app.workphelo.com/${slug}/login`;

  return (
    <div className={cardClass('flex items-center justify-between px-5 py-4')}>
      {/* Left — name, status, url */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-900">{name}</span>
          <StatusBadge status={status} />
        </div>
        <span className="text-sm text-gray-500">{workspaceUrl}</span>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-3">
        {onResendInvite && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResendInvite}
            isLoading={isResendingInvite}
            loadingText="Sending..."
          >
            Resend Invite
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => deleteTenant(id, { onSuccess: () => router.push('/dashboard') })}
          isLoading={isDeleting}
          loadingText="Deleting..."
          className="gap-2"
        >
          Delete Company
          <Icons.Trash2 className="w-5 h-5" />
        </Button>
        {isSuspended ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => activate(id, { onSuccess: invalidateTenant })}
            isLoading={isActivating}
            loadingText="Activating..."
            className="gap-2"
          >
            Activate
            <Icons.CircleCheck className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => deactivate(id, { onSuccess: invalidateTenant })}
            isLoading={isDeactivating}
            loadingText="Deactivating..."
            className="gap-2"
          >
            Suspend
            <Icons.CircleX className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
