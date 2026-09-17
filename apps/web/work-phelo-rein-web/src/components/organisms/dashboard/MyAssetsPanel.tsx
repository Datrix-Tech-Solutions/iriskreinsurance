'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useMyProfile } from '@/hooks/hr/useEmployees';
import { AssetTypeIcon } from '@/components/atoms/assetIcons';
import type { EmployeeAsset } from '@/types/asset';

interface MyAssetsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function AssetRow({ asset }: { asset: EmployeeAsset }) {
  const formattedDate = new Date(asset.assignedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex items-center gap-4 border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="w-20 h-16 shrink-0 bg-brand-tint flex items-center justify-center">
        <AssetTypeIcon type={asset.type} size="sm" className="w-7 h-7" />
      </div>
      <div className="flex flex-col min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{asset.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">Assigned {formattedDate}</p>
      </div>
    </div>
  );
}

export function MyAssetsPanel({ isOpen, onClose }: MyAssetsPanelProps) {
  const { data: profile, isLoading } = useMyProfile();
  const assets = profile?.assets ?? [];

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="My Assets"
      description="Assets currently assigned to you."
      width="sm:w-[480px]"
    >
      {isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <p className="text-sm text-gray-400">No assets assigned to you.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {assets.map((asset) => (
            <AssetRow key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </SidePanel>
  );
}
