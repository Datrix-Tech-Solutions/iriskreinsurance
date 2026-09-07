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

export function UnassignAssetModal({ isOpen, onClose, asset, onConfirm, isLoading }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Unassign Asset"
      description={
        asset
          ? `Are you sure you want to unassign "${asset.name}" from ${asset.assignedEmployeeName ?? 'the current employee'}?`
          : ''
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
            Unassign
          </Button>
        </>
      }
    />
  );
}
