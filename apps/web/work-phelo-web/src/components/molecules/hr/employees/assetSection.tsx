import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { AssetCard } from '@/components/molecules/hr/employees/empAssetCard';
import { EmployeeAsset } from '@/types/asset';

interface Props {
  assets: EmployeeAsset[];
  onAssignAsset?: () => void;
}

export function AssetsSection({ assets, onAssignAsset }: Props) {
  const headerAction = onAssignAsset ? (
    <button
      onClick={onAssignAsset}
      className="text-xs font-medium text-brand hover:text-brand/80 transition-colors"
    >
      + Assign Asset
    </button>
  ) : undefined;

  if (assets.length === 0) {
    return (
      <SectionCard title="Assets" headerAction={headerAction}>
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400">No assets assigned to this employee.</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Assets" scrollX headerAction={headerAction}>
      <div className="flex gap-2 px-3 py-0" style={{ width: 'max-content', minWidth: '100%' }}>
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>
    </SectionCard>
  );
}
