'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { AssetTypeIcon } from '@/components/atoms/assetIcons';
import { Asset, AssetStatus, AssetCondition } from '@/types/asset';
import { useBranchOptions } from '@/hooks';
import { getAssetTypeLabel, VEHICLE_TYPE_OPTIONS } from '@/lib/assetOptions';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<AssetStatus, { dot: string; text: string; bg: string; label: string }> =
  {
    AVAILABLE: {
      dot: 'bg-green-500',
      text: 'text-green-700',
      bg: 'bg-green-50',
      label: 'Available',
    },
    ASSIGNED: { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Assigned' },
    MAINTENANCE: {
      dot: 'bg-yellow-400',
      text: 'text-yellow-700',
      bg: 'bg-yellow-50',
      label: 'Maintenance',
    },
    RETIRED: { dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-100', label: 'Retired' },
  };

const CONDITION_LABELS: Record<AssetCondition, string> = {
  NEW: 'New',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

const VEHICLE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  VEHICLE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value ?? '—'}</span>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  canManage?: boolean;
  canAssign?: boolean;
  onEdit?: () => void;
  onAssign?: () => void;
  onUnassign?: () => void;
  onTransfer?: () => void;
  onMaintenance?: () => void;
  onRetire?: () => void;
  onDelete?: () => void;
}

export function AssetDetailPanel({
  isOpen,
  onClose,
  asset,
  canManage,
  canAssign,
  onEdit,
  onAssign,
  onUnassign,
  onTransfer,
  onMaintenance,
  onRetire,
  onDelete,
}: Props) {
  const { data: branchOptions = [] } = useBranchOptions();

  if (!asset) return null;

  const status = STATUS_STYLES[asset.status];
  const isAssigned = asset.status === 'ASSIGNED';
  const isMaintenance = asset.status === 'MAINTENANCE';
  const isRetired = asset.status === 'RETIRED';
  const isVehicle = asset.type === 'VEHICLE';

  const branchName = asset.branchId
    ? (branchOptions.find((b) => b.id === asset.branchId)?.name ?? '—')
    : '—';

  const formattedPurchaseDate = asset.purchaseDate
    ? new Date(asset.purchaseDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const formattedPurchaseCost =
    asset.purchaseCost != null
      ? `${asset.currency ?? ''} ${asset.purchaseCost.toLocaleString()}`.trim()
      : null;

  const formattedAssignedAt = asset.assignedAt
    ? new Date(asset.assignedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Asset Details"
      description={asset.assetNumber ?? ''}
      footer={
        <Button variant="outline" onClick={onClose} className="w-full">
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Identity */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
          <div className="w-12 h-12 rounded-xl bg-brand-tint flex items-center justify-center shrink-0">
            <AssetTypeIcon type={asset.type} size="md" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">{asset.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{getAssetTypeLabel(asset)}</p>
          </div>
          <span
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-semibold shrink-0',
              status.bg,
              status.text,
            )}
          >
            {status.label}
          </span>
        </div>

        {/* Details */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
            Details
          </p>
          <div>
            <DetailRow
              label={isVehicle ? 'Registration No.' : 'Serial Number'}
              value={asset.serialNumber}
            />
            {isVehicle && (
              <DetailRow
                label="Vehicle Type"
                value={
                  asset.vehicleType
                    ? (VEHICLE_TYPE_LABELS[asset.vehicleType] ?? asset.vehicleType)
                    : null
                }
              />
            )}
            <DetailRow
              label="Condition"
              value={asset.condition ? CONDITION_LABELS[asset.condition] : null}
            />
            <DetailRow label="Purchase Date" value={formattedPurchaseDate} />
            <DetailRow label="Purchase Cost" value={formattedPurchaseCost} />
            <DetailRow label="Branch" value={branchName} />
          </div>
        </div>

        {/* Assignment */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
            Assignment
          </p>
          <div>
            <DetailRow
              label="Assigned To"
              value={isAssigned ? (asset.assignedEmployeeName ?? '—') : 'Unassigned'}
            />
            {isAssigned && <DetailRow label="Assigned On" value={formattedAssignedAt} />}
          </div>
        </div>

        {/* Notes */}
        {asset.notes && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Notes
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{asset.notes}</p>
          </div>
        )}

        {/* Actions */}
        {(canManage || canAssign) && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Actions
            </p>
            <div className="flex flex-col gap-2">
              {canManage && onEdit && (
                <Button variant="outline" onClick={onEdit} className="w-full justify-start">
                  Edit Asset
                </Button>
              )}

              {canAssign && isAssigned && onUnassign && (
                <Button variant="outline" onClick={onUnassign} className="w-full justify-start">
                  Unassign
                </Button>
              )}
              {canAssign && isAssigned && onTransfer && (
                <Button variant="outline" onClick={onTransfer} className="w-full justify-start">
                  Transfer to Another Employee
                </Button>
              )}
              {canAssign && !isAssigned && !isRetired && onAssign && (
                <Button variant="outline" onClick={onAssign} className="w-full justify-start">
                  Assign to Employee
                </Button>
              )}

              {canManage && !isRetired && onMaintenance && (
                <Button variant="outline" onClick={onMaintenance} className="w-full justify-start">
                  {isMaintenance ? 'Mark as Available' : 'Send to Maintenance'}
                </Button>
              )}

              {canManage && !isRetired && onRetire && (
                <Button
                  variant="outline"
                  onClick={onRetire}
                  className="w-full justify-start text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                >
                  Retire Asset
                </Button>
              )}

              {canManage && onDelete && (
                <Button variant="danger" onClick={onDelete} className="w-full justify-start">
                  Delete Asset
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
