import { ShieldCheck, ShieldCog } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';

interface EmployeeActionsBarProps {
  isPendingInvite: boolean;
  isOffboarded: boolean;
  resendInvite: () => void;
  isResending?: boolean;
  onAssignAsset?: () => void;
  onAssignRole?: () => void;
  onAssignPermission?: () => void;
  onOffboard?: () => void;
  onResign: () => void;
  hasPendingResignation?: boolean;
  onEdit?: () => void;
}

export function EmployeeActionsBar({
  isPendingInvite,
  isOffboarded,
  resendInvite,
  isResending,
  onAssignAsset,
  onAssignRole,
  onAssignPermission,
  onOffboard,
  onResign,
  hasPendingResignation,
  onEdit,
}: EmployeeActionsBarProps) {
  return (
    <div className="flex items-center justify-end gap-3">
      {onAssignRole && !isOffboarded && !isPendingInvite && (
        <Button variant="outline" size="sm" onClick={onAssignRole} className="gap-2">
          Manage Permission Sets
          <ShieldCheck className="w-4 h-4" />
        </Button>
      )}

      {isPendingInvite ? (
        <Button
          variant="outline"
          size="sm"
          onClick={resendInvite}
          isLoading={isResending}
          loadingText="Sending..."
        >
          Resend Invite
        </Button>
      ) : !isOffboarded ? (
        <>
          {onAssignPermission && (
            <Button variant="outline" size="sm" onClick={onAssignPermission} className="gap-2">
              Grant Direct Permissions
              <ShieldCog className="w-4 h-4" />
            </Button>
          )}
          {onAssignAsset && (
            <Button variant="outline" size="sm" onClick={onAssignAsset}>
              Assign Asset
            </Button>
          )}
          {hasPendingResignation && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResign}
              className="text-amber-600 border-amber-400 bg-amber-50 hover:bg-amber-100"
            >
              Pending Resignation
            </Button>
          )}
          {onOffboard && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOffboard}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              Off-Board
              <Icons.UserMinus className="w-5 h-5" />
            </Button>
          )}
        </>
      ) : null}

      {onEdit && (
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
          Edit
          <Icons.UserPen className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
