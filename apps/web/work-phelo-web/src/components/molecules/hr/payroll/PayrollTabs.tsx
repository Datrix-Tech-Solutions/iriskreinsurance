'use client';

import { TabBar } from '@/components/molecules/shared/TabBar';
import { usePayrollSettings } from '@/hooks';
import { getPayrollLabels } from '@/lib/payrollDisplay';

interface Props {
  activeTab: 'payslip' | 'manage' | 'ssnit' | 'approve' | 'history';
  isEmployee: boolean;
  canManage: boolean;
  canApprove: boolean;
  canViewHistory: boolean;
  country?: string;
  onTabChange: (tab: 'payslip' | 'manage' | 'ssnit' | 'approve' | 'history') => void;
  className?: string;
}

export function PayrollTabs({
  activeTab,
  isEmployee,
  canManage,
  canApprove,
  canViewHistory,
  onTabChange,
  className,
}: Props) {
  const { data: payrollSettings } = usePayrollSettings();
  const payrollLabels = getPayrollLabels(payrollSettings?.payrollCountry);
  const tabs = [
    ...(isEmployee ? [{ key: 'payslip', label: 'My Payslip' }] : []),
    ...(canManage ? [{ key: 'manage', label: 'Manage Payroll' }] : []),
    ...(canManage ? [{ key: 'ssnit', label: payrollLabels.tabLabel }] : []),
    ...(canApprove ? [{ key: 'approve', label: 'Approve Payroll' }] : []),
    ...(canViewHistory ? [{ key: 'history', label: 'History' }] : []),
  ];

  return (
    <TabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) =>
        onTabChange(tab as 'payslip' | 'manage' | 'ssnit' | 'approve' | 'history')
      }
      className={className}
    />
  );
}
