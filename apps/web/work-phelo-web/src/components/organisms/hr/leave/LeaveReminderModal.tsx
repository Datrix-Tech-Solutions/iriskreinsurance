'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLeaveRequests } from '@/hooks';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

const SESSION_KEY = 'leave_reminder_shown';

export function LeaveReminderModal({ tenantSlug }: { tenantSlug: string }) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && !!sessionStorage.getItem(SESSION_KEY),
  );
  const router = useRouter();
  const { data: pendingRequests } = useLeaveRequests('PENDING');

  const pendingCount = pendingRequests?.length ?? 0;

  const open = pendingCount > 0 && !dismissed;

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
  };

  const goToLeave = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
    router.push(`/${tenantSlug}/hr/leave`);
  };

  return (
    <Modal
      isOpen={open}
      onClose={dismiss}
      title="Pending Leave Requests"
      description={`You have ${pendingCount} pending leave request${pendingCount !== 1 ? 's' : ''} awaiting your review.`}
      footer={
        <>
          <Button variant="secondary" onClick={dismiss}>
            Dismiss
          </Button>
          <Button onClick={goToLeave}>Go to Leave</Button>
        </>
      }
    />
  );
}
