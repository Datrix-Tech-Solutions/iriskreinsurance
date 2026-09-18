'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';

interface EndorsementCloseSectionProps {
  isClosed: boolean;
  isUpdatingStatus: boolean;
  isReadyToClose: boolean;
  canForceClose: boolean;
  /** Endorsement workflow permission — hides the whole section when absent. */
  canManage: boolean;
  acceptedPercent: number;
  targetPercent: number | null;
  onClose: () => void;
  onForceClose: () => void;
}

/**
 * "Validate Endorsement" action — renders nothing once the endorsement is
 * already closed. When the endorsement has reached full target capacity it
 * closes normally; when every participant has responded but capacity is
 * still short, it offers a force close (confirmed via modal) at the
 * currently agreed lines instead.
 */
export function EndorsementCloseSection({
  isClosed,
  isUpdatingStatus,
  isReadyToClose,
  canForceClose,
  canManage,
  acceptedPercent,
  targetPercent,
  onClose,
  onForceClose,
}: EndorsementCloseSectionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isClosed || !canManage) return null;

  const handleClick = () => {
    if (isReadyToClose) {
      onClose();
    } else if (canForceClose) {
      setConfirmOpen(true);
    }
  };

  const handleConfirmForceClose = () => {
    setConfirmOpen(false);
    onForceClose();
  };

  return (
    <section className="flex flex-col gap-3 border-t border-gray-100 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="danger"
          size="sm"
          isLoading={isUpdatingStatus}
          disabled={!isReadyToClose && !canForceClose}
          onClick={handleClick}
        >
          Validate Endorsement
        </Button>
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Force Close Endorsement"
        description={`Every invited participant has responded, but only ${acceptedPercent}%${
          targetPercent != null ? ` of the ${targetPercent}% target` : ''
        } has been accepted. Force closing will issue and confirm closings for the accepted lines only, and permanently close the endorsement. This action cannot be undone.`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isUpdatingStatus}
              onClick={handleConfirmForceClose}
            >
              Force Close
            </Button>
          </>
        }
      />
    </section>
  );
}
