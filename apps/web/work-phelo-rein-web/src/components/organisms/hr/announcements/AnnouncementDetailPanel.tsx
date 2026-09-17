'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import type { Announcement, AnnouncementAudienceType } from '@/types/hr';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  announcement: Announcement | null;
}

const AUDIENCE_LABELS: Record<AnnouncementAudienceType, string> = {
  ALL: 'Everyone in the organisation',
  DEPARTMENTS: 'Specific departments',
  BRANCHES: 'Specific branches',
  EMPLOYEES: 'Specific employees',
};

function fmtDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

export function AnnouncementDetailPanel({ isOpen, onClose, announcement }: Props) {
  const hasEmail = !!announcement?.sendEmail || !!announcement?.deliveryChannels?.includes('EMAIL');
  const hasSms = !!announcement?.deliveryChannels?.includes('SMS');

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={announcement?.title ?? 'Announcement'}
      description="Announcement details"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {announcement && (
        <div className="flex flex-col gap-5">
          <DetailRow label="Message">
            <p className="whitespace-pre-wrap leading-relaxed">{announcement.body}</p>
          </DetailRow>

          <DetailRow label="Audience">{AUDIENCE_LABELS[announcement.audienceType]}</DetailRow>

          <DetailRow label="Delivery">
            <div className="flex gap-2">
              <Badge
                label={hasEmail ? 'Email' : 'No email'}
                variant={hasEmail ? 'success' : 'neutral'}
              />
              <Badge label={hasSms ? 'SMS' : 'No SMS'} variant={hasSms ? 'success' : 'neutral'} />
            </div>
          </DetailRow>

          <DetailRow label="Published">{fmtDate(announcement.publishedAt) ?? '—'}</DetailRow>

          <DetailRow label="Expires">{fmtDate(announcement.expiresAt) ?? 'No expiry'}</DetailRow>
        </div>
      )}
    </SidePanel>
  );
}
