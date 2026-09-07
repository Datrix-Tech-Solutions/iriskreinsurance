import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: 'my' | 'team' | 'hr';
  isEmployee: boolean;
  canReviewTeam: boolean;
  canViewAppraisals: boolean;
  teamUnreviewedCount?: number;
  onTabChange: (tab: 'my' | 'team' | 'hr') => void;
  className?: string;
}

export function AppraisalTabs({
  activeTab,
  isEmployee,
  canReviewTeam,
  canViewAppraisals,
  teamUnreviewedCount = 0,
  onTabChange,
  className,
}: Props) {
  const tabs = [
    ...(isEmployee ? [{ key: 'my', label: 'My Appraisal' }] : []),
    ...(canReviewTeam ? [{ key: 'team', label: 'Team Review', count: teamUnreviewedCount }] : []),
    ...(canViewAppraisals ? [{ key: 'hr', label: 'Appraisals' }] : []),
  ];

  return (
    <TabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => onTabChange(tab as 'my' | 'team' | 'hr')}
      className={className}
    />
  );
}
