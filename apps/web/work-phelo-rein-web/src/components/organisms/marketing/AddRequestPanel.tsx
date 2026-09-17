'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSendRequest: () => void;
  onCancel: () => void;
}

export function AddRequestPanel({ isOpen, onClose, onSendRequest, onCancel }: Props) {
  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="New Request"
      description="Create a new transport request."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSendRequest}>Send Request</Button>
        </div>
      }
    >
      <div />
    </SidePanel>
  );
}
