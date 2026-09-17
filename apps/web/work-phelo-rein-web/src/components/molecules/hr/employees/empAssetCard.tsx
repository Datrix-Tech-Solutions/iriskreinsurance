import { AssetTypeIcon } from '@/components/atoms/assetIcons';
import { EmployeeAsset } from '@/types/asset';

export function AssetCard({ asset }: { asset: EmployeeAsset }) {
  const assignedDate = new Date(asset.assignedAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const condition = asset.condition
    ? asset.condition.charAt(0) + asset.condition.slice(1).toLowerCase()
    : null;

  return (
    <div className="w-52 shrink-0 bg-gray-50 border border-gray-200 rounded-2xl p-3 flex flex-col gap-2">
      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
        <AssetTypeIcon type={asset.type} size="sm" className="text-gray-600" />
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-bold text-gray-900 leading-snug">{asset.name}</p>
        {asset.serialNumber && <p className="text-xs text-gray-500">S/N: {asset.serialNumber}</p>}
      </div>

      <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-gray-400">Assigned On</p>
          <p className="text-xs font-semibold text-gray-900">{assignedDate}</p>
        </div>
        {condition && (
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-gray-400">Asset Condition</p>
            <p className="text-xs font-semibold text-gray-900">{condition}</p>
          </div>
        )}
      </div>
    </div>
  );
}
