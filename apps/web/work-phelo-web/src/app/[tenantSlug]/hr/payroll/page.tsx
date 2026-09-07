'use client';

import { use, useEffect, useMemo } from 'react';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { cn } from '@/lib/utils';
import { pageHeader, pagePx, pageContent } from '@/lib/layout';
import { PayrollTabs } from '@/components/molecules/hr/payroll/PayrollTabs';
import { MyPayslipTab } from '@/components/organisms/hr/payroll/MyPayslipTab';
import { ManagePayrollTab } from '@/components/organisms/hr/payroll/ManagePayrollTab';
import { SSNITTab } from '@/components/organisms/hr/payroll/SSNITTab';
import { PensionTab_NG } from '@/components/organisms/hr/payroll/PensionTab_NG';
import { NSSFTab_KE } from '@/components/organisms/hr/payroll/NSSFTab_KE';
import { ApprovePayrollTab } from '@/components/organisms/hr/payroll/ApprovePayrollTab';
import { PayrollHistoryTab } from '@/components/organisms/hr/payroll/PayrollHistoryTab';
import { usePayrollSettings } from '@/hooks';

type Tab = 'payslip' | 'manage' | 'ssnit' | 'approve' | 'history';

export default function PayrollPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: payrollSettings } = usePayrollSettings();
  const payrollCountry = payrollSettings?.payrollCountry ?? 'GH';

  useEffect(() => {
    if (user !== null && !user.featureConfig?.hr?.payroll) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [user, tenantSlug, router]);

  const hasHRProfile = user?.role === 'EMPLOYEE';
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);
  const canViewHistory = canManagePayroll || canApprovePayroll;
  const searchParams = useSearchParams();

  const initialTab = useMemo((): Tab => {
    const t = searchParams.get('tab') as Tab | null;
    if (t === 'history' && canViewHistory) return 'history';
    if (t === 'approve' && canApprovePayroll) return 'approve';
    if (t === 'ssnit' && canManagePayroll) return 'ssnit';
    if (t === 'manage' && canManagePayroll) return 'manage';
    if (t === 'payslip' && hasHRProfile) return 'payslip';
    return canManagePayroll ? 'manage' : hasHRProfile ? 'payslip' : 'manage';
  }, [searchParams, canApprovePayroll, canManagePayroll, canViewHistory, hasHRProfile]);

  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  function renderContributionsTab() {
    if (payrollCountry === 'NG') return <PensionTab_NG />;
    if (payrollCountry === 'KE') return <NSSFTab_KE />;
    return <SSNITTab />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-bold text-gray-900">Payroll Management</h1>
        </div>
        <PayrollTabs
          activeTab={tab}
          isEmployee={hasHRProfile}
          canManage={canManagePayroll}
          canApprove={canApprovePayroll}
          canViewHistory={canViewHistory}
          country={payrollCountry}
          onTabChange={setTab}
          className={pagePx}
        />
      </div>

      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col')}>
        {tab === 'payslip' && hasHRProfile && <MyPayslipTab />}
        {tab === 'manage' && canManagePayroll && <ManagePayrollTab />}
        {tab === 'ssnit' && canManagePayroll && renderContributionsTab()}
        {tab === 'approve' && canApprovePayroll && <ApprovePayrollTab />}
        {tab === 'history' && canViewHistory && <PayrollHistoryTab />}
      </div>
    </div>
  );
}
