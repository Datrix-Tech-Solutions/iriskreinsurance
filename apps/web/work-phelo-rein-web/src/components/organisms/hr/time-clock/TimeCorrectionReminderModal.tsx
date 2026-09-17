'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCorrectionRequests } from '@/hooks/hr/useTimeClock';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

const SESSION_KEY = 'time_correction_reminder_shown';

export function TimeCorrectionReminderModal({ tenantSlug }: { tenantSlug: string }) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && !!sessionStorage.getItem(SESSION_KEY),
  );
  const router = useRouter();
  const { data: pendingRequests } = useCorrectionRequests('PENDING');

  const pendingCount = pendingRequests?.length ?? 0;

  const open = pendingCount > 0 && !dismissed;

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
  };

  const goToCorrections = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
    router.push(`/${tenantSlug}/hr/time-clock?tab=corrections`);
  };

  return (
    <Modal
      isOpen={open}
      onClose={dismiss}
      title="Pending Time Corrections"
      description={`You have ${pendingCount} pending time correction${pendingCount !== 1 ? 's' : ''} awaiting your review.`}
      footer={
        <>
          <Button variant="secondary" onClick={dismiss}>
            Dismiss
          </Button>
          <Button onClick={goToCorrections}>Go to Corrections</Button>
        </>
      }
    />
  );
}
