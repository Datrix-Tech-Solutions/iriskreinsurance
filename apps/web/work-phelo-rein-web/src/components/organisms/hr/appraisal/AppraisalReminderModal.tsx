'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTeamAppraisals } from '@/hooks';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

const SESSION_KEY = 'appraisal_reminder_shown';

export function AppraisalReminderModal({ tenantSlug }: { tenantSlug: string }) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && !!sessionStorage.getItem(SESSION_KEY),
  );
  const router = useRouter();
  const { data: teamData } = useTeamAppraisals();

  const unreviewedCount = teamData?.filter((r) => r.overallStatus === 'SelfSubmitted').length ?? 0;

  const open = unreviewedCount > 0 && !dismissed;

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
  };

  const goToAppraisals = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
    router.push(`/${tenantSlug}/hr/appraisal`);
  };

  return (
    <Modal
      isOpen={open}
      onClose={dismiss}
      title="Pending Team Reviews"
      description={`You have ${unreviewedCount} team member${unreviewedCount !== 1 ? 's' : ''} awaiting your appraisal review.`}
      footer={
        <>
          <Button variant="secondary" onClick={dismiss}>
            Dismiss
          </Button>
          <Button onClick={goToAppraisals}>Go to Appraisals</Button>
        </>
      }
    />
  );
}
