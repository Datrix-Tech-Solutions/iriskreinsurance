'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  base: string;
  className?: string;
}

export function NavigateTabs({ base, className }: Props) {
  const tabs = [
    { key: 'all-requests', label: 'All Requests', href: `${base}/all-requests` },
    { key: 'request-history', label: 'Request History', href: `${base}/request-history` },
    {
      key: 'transport-officer-location',
      label: 'Transport Officer Location',
      href: `${base}/transport-officer-location`,
    },
    { key: 'fleets', label: 'Fleets', href: `${base}/fleets` },
  ];

  return <TabBar tabs={tabs} className={className} />;
}
