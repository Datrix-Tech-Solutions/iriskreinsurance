'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  base: string;
  className?: string;
}

export function ProspectingTabs({ base, className }: Props) {
  const tabs = [
    { key: 'sales-pipeline', label: 'Sales Pipeline', href: `${base}/sales-pipeline` },
    { key: 'product', label: 'Product', href: `${base}/product` },
    { key: 'decision-maker', label: 'Decision Maker', href: `${base}/decision-maker` },
    { key: 'source-type', label: 'Source Type', href: `${base}/source-type` },
    { key: 'interaction-medium', label: 'Interaction Medium', href: `${base}/interaction-medium` },
    {
      key: 'prospect-business-type',
      label: 'Prospect Business Type',
      href: `${base}/prospect-business-type`,
    },
  ];

  return <TabBar tabs={tabs} className={className} />;
}
