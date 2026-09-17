import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { TableButton } from '@/components/atoms/TableButton';
import { AssetCard } from '@/components/molecules/hr/employees/empAssetCard';
import { EmployeeAsset } from '@/types/asset';

interface Props {
  assets: EmployeeAsset[];
  onAssignAsset?: () => void;
  onManage?: () => void;
}

export function AssetsSection({ assets, onAssignAsset, onManage }: Props) {
  const headerAction =
    onAssignAsset || onManage ? (
      <div className="flex items-center gap-3">
        {onAssignAsset && (
          <button
            onClick={onAssignAsset}
            className="text-xs font-medium text-brand hover:text-brand/80 transition-colors"
          >
            + Assign Asset
          </button>
        )}
        {onManage && (
          <TableButton variant="blue" onClick={onManage}>
            Manage
          </TableButton>
        )}
      </div>
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
