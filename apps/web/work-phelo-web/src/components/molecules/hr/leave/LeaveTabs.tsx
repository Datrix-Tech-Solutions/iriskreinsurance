import { useLeaveRequests } from '@/hooks/hr/useLeave';
import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: string;
  canReviewRequests: boolean;
  isEmployee: boolean;
  onTabChange: (tab: string) => void;
  className?: string;
}

export function LeaveTabs({
  activeTab,
  canReviewRequests,
  isEmployee,
  onTabChange,
  className,
}: Props) {
  const { data: pendingList = [] } = useLeaveRequests('PENDING', { enabled: canReviewRequests });

  const pendingCount = (pendingList as unknown[]).length;

  const tabs = [
    ...(isEmployee ? [{ key: 'my', label: 'My Leave' }] : []),
    ...(canReviewRequests
      ? [{ key: 'requests', label: 'Leave Requests', count: pendingCount }]
      : []),
  ];

  return (
    <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} className={className} />
  );
}
