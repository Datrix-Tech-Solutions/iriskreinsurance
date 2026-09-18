import { Asset, AssetStatus, AssetCondition } from '@/types/asset';
import { AssetType, AssetTypeIcon } from '@/components/atoms/assetIcons';
import { DataCard, DataCardAction, DataCardDetail } from '@/components/organisms/shared/DataCard';
import { cn } from '@/lib/utils';

const ASSET_TYPE_COLORS: Record<AssetType, { bg: string; text: string }> = {
  LAPTOP: { bg: 'bg-blue-100', text: 'text-blue-700' },
  PHONE: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  TABLET: { bg: 'bg-violet-100', text: 'text-violet-700' },
  PRINTER: { bg: 'bg-amber-100', text: 'text-amber-700' },
  MONITOR: { bg: 'bg-teal-100', text: 'text-teal-700' },
  VEHICLE: { bg: 'bg-orange-100', text: 'text-orange-700' },
  FURNITURE: { bg: 'bg-pink-100', text: 'text-pink-700' },
  SOFTWARE_LICENSE: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  OTHER: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const STATUS_STYLES: Record<AssetStatus, { text: string; bg: string; label: string }> = {
  AVAILABLE: { text: 'text-green-700', bg: 'bg-green-50', label: 'Available' },
  ASSIGNED: { text: 'text-blue-700', bg: 'bg-blue-50', label: 'Assigned' },
  MAINTENANCE: { text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Maintenance' },
  RETIRED: { text: 'text-gray-500', bg: 'bg-gray-100', label: 'Retired' },
};

const CONDITION_STYLES: Record<AssetCondition, { text: string; bg: string; label: string }> = {
  NEW: { text: 'text-green-700', bg: 'bg-green-50', label: 'New' },
  GOOD: { text: 'text-blue-700', bg: 'bg-blue-50', label: 'Good' },
  FAIR: { text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Fair' },
  POOR: { text: 'text-red-700', bg: 'bg-red-50', label: 'Poor' },
};

function AssetCard({
  asset,
  onView,
  onEdit,
  onAssign,
  onUnassign,
  onTransfer,
}: {
  asset: Asset;
  onView?: () => void;
  onEdit?: () => void;
  onAssign?: () => void;
  onUnassign?: () => void;
  onTransfer?: () => void;
}) {
  const isAssigned = asset.status === 'ASSIGNED';
  const typeColor = ASSET_TYPE_COLORS[asset.type] ?? ASSET_TYPE_COLORS.OTHER;
  const statusStyle = STATUS_STYLES[asset.status];

  const formattedPurchaseDate = asset.purchaseDate
    ? new Date(asset.purchaseDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  const actions: DataCardAction[] = [];

  if (onEdit) {
    actions.push({
      label: 'Edit',
      onClick: onEdit,
      className: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    });
  }

  if (isAssigned) {
    if (onUnassign) {
      actions.push({
        label: 'Unassign',
        onClick: onUnassign,
        className: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
      });
    }
    if (onTransfer) {
      actions.push({
        label: 'Transfer',
        onClick: onTransfer,
        className: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
      });
    }
  } else if (asset.status === 'AVAILABLE' && onAssign) {
    actions.push({
      label: 'Assign',
      onClick: onAssign,
      className: 'bg-green-50 text-green-600 hover:bg-green-100',
    });
  }

  const details: DataCardDetail[] = [
    {
      label: asset.type === 'VEHICLE' ? 'Reg. No.' : 'Serial',
      value: (
        <span className="text-xs font-mono text-gray-700 truncate max-w-[55%] text-right">
          {asset.serialNumber ?? '—'}
        </span>
      ),
    },
    {
      label: 'Condition',
      value: (
        <span className="text-xs font-semibold text-gray-700">
          {asset.condition ? CONDITION_STYLES[asset.condition].label : '—'}
        </span>
      ),
    },
    {
      label: 'Purchased',
      value: <span className="text-xs font-semibold text-gray-700">{formattedPurchaseDate}</span>,
    },
    {
      label: 'Assigned To',
      value: (
        <span
          className={cn(
            'text-xs font-semibold truncate max-w-[55%] text-right',
            isAssigned ? 'text-blue-600' : 'text-gray-400',
          )}
        >
          {asset.assignedEmployeeName ?? 'Unassigned'}
        </span>
      ),
    },
  ];

  return (
    <DataCard
      onClick={onView}
      icon={
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            typeColor.bg,
          )}
        >
          <AssetTypeIcon type={asset.type} size="sm" className={typeColor.text} />
        </div>
      }
      title={asset.name}
      subtitle={asset.assetNumber}
      badge={
        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-semibold shrink-0',
            statusStyle.bg,
            statusStyle.text,
          )}
        >
          {statusStyle.label}
        </span>
      }
      details={details}
      actions={actions}
    />
  );
}

export default AssetCard;
