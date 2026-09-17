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

export function DeleteAssetModal({ isOpen, onClose, asset, onConfirm, isLoading }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Asset"
      description={
        asset
          ? `Are you sure you want to permanently delete "${asset.name}"? This action cannot be undone.`
          : 'Are you sure you want to delete this asset?'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => asset && onConfirm(asset.id)}
            disabled={isLoading || !asset}
          >
            {isLoading ? 'Deleting…' : 'Delete Asset'}
          </Button>
        </>
      }
    />
  );
}
