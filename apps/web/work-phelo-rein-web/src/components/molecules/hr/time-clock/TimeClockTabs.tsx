import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: 'my' | 'live' | 'records' | 'corrections';
  canManageRecords: boolean;
  canApproveCorrections: boolean;
  isEmployee: boolean;
  pendingCount: number;
  onTabChange: (tab: 'my' | 'live' | 'records' | 'corrections') => void;
  className?: string;
}

export function TimeClockTabs({
  activeTab,
  canManageRecords,
  canApproveCorrections,
  isEmployee,
  pendingCount,
  onTabChange,
  className,
}: Props) {
  const tabs = [
    ...(isEmployee ? [{ key: 'my', label: 'My Time' }] : []),
    ...(canManageRecords
      ? [
          { key: 'live', label: 'Live' },
          { key: 'records', label: 'Records' },
        ]
      : []),
    ...(canApproveCorrections
      ? [{ key: 'corrections', label: 'Corrections', count: pendingCount }]
      : []),
  ];

  return (
    <TabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => onTabChange(tab as 'my' | 'live' | 'records' | 'corrections')}
      className={className}
    />
  );
}
