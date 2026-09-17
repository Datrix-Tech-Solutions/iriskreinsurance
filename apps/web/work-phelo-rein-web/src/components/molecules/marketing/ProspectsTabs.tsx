'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  base: string;
  className?: string;
}

export function ProspectsTabs({ base, className }: Props) {
  const tabs = [
    { key: 'all', label: 'All Prospects', href: `${base}/all` },
    {
      key: 'upcoming-follow-ups',
      label: 'Upcoming Follow Ups',
      href: `${base}/upcoming-follow-ups`,
    },
  ];

  return <TabBar tabs={tabs} className={className} />;
}
