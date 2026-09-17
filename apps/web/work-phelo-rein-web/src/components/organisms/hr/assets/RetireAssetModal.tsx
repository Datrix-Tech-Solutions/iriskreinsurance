'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Asset } from '@/types/asset';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onConfirm: (assetId: string) => void;
  isLoading?: boolean;
}

export function RetireAssetModal({ isOpen, onClose, asset, onConfirm, isLoading }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Retire Asset"
      description={
        asset
          ? `Are you sure you want to retire "${asset.name}" (${asset.assetNumber ?? asset.serialNumber ?? 'no serial'})? This will mark it as no longer in active use.`
          : 'Are you sure you want to retire this asset?'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => asset && onConfirm(asset.id)}
            disabled={isLoading || !asset}
            className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
          >
            {isLoading ? 'Retiring…' : 'Retire Asset'}
          </Button>
        </>
      }
    />
  );
}
