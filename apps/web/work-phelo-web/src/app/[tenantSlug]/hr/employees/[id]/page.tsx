'use client';

import { use, useState } from 'react';
import axios from 'axios';
import {
  useEmployee,
  useEmployeeOptions,
  useResendEmployeeInvite,
  useResignationRecord,
} from '@/hooks/hr/useEmployees';
import { useAvailableAssets } from '@/hooks/hr/useAssets';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import {
  useAssignPermissionSet,
  usePermissionSets,
  useRemovePermissionSet,
  useUserPermissions,
} from '@/hooks/hr/useRoles';
import { useToast } from '@/hooks/useToast';
import { Breadcrumb } from '@/components/molecules/hr/employees/employeebreadcrumps';
import { EmployeeDetailBanner } from '@/components/molecules/hr/employees/EmployeeDetailBanner';
import { EmployeeDetailSidebar } from '@/components/molecules/hr/employees/EmployeeDetailSidebar';
import { PersonalInformationSection } from '@/components/molecules/hr/employees/PersonalInformationSection';
import { AssetsSection } from '@/components/molecules/hr/employees/assetSection';
import { EmergencyContactSection } from '@/components/molecules/hr/employees/emergencyContactSection';
import { EmployeeDetailSkeleton } from '@/components/molecules/hr/employees/employeeDetailSkeleton';
import { TabBar } from '@/components/molecules/shared/TabBar';
import {
  EmployeeDetailPanels,
  type EmployeeDetailPanel,
} from '@/components/organisms/hr/employee/EmployeeDetailPanels';
import { EmployeePayslipTab } from '@/components/molecules/hr/employees/EmployeePayslipTab';
import { pageBreadcrumb, pageBanner, pagePx, pageContent } from '@/lib/layout';

type EmployeeTab = 'personal' | 'payroll';

const TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'payroll', label: 'Payroll' },
];

const NOTIFY_DELAY_MS = 30 * 60 * 1000;

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);

  const [activeTab, setActiveTab] = useState<EmployeeTab>('personal');
  const [activePanel, setActivePanel] = useState<EmployeeDetailPanel | null>(null);

  const { data: employee, isLoading, error } = useEmployee(id);
  const { data: resignationRecord } = useResignationRecord(id);
  const { data: allHrEmployees = [] } = useEmployeeOptions();
  const { data: availableAssets = [] } = useAvailableAssets();
  const { data: userPermsRaw } = useUserPermissions(employee?.userId ?? '');

  const canGrantPermission = usePermission(Permission.GRANT_PERMISSION);
  const canAssignAsset = usePermission(Permission.ASSIGN_ASSET);
  const canEditEmployee = usePermission(Permission.UPDATE_EMPLOYEE);
  const canOffboardEmployee = usePermission(Permission.OFFBOARD_EMPLOYEE);

  const { data: permissionSets = [] } = usePermissionSets({ enabled: canGrantPermission });
  const { mutate: resendInvite, isPending: isResending } = useResendEmployeeInvite();
  const { mutate: assignPermissionSet, isPending: isAssigningPermissionSet } =
    useAssignPermissionSet();
  const { mutate: removePermissionSet, isPending: isRemovingPermissionSet } =
    useRemovePermissionSet();

  const toast = useToast();

  const userPermsTyped = userPermsRaw as
    | {
        permissionSets?: { id: string; name: string }[];
        directPermissions?: { resourceName: string; action: string }[];
      }
    | undefined;
  const assignedSets = userPermsTyped?.permissionSets ?? [];
  const directPermissions = userPermsTyped?.directPermissions ?? [];
  const customPermissionSets = permissionSets.filter((s) => !s.isSystem);
  const roles = assignedSets.map((s) => s.name);

  const managerName = (() => {
    if (!employee?.managerId) return undefined;
    const mgr = allHrEmployees.find((e) => e.id === employee.managerId);
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : undefined;
  })();

  const hrIsNotified =
    resignationRecord?.status === 'PENDING' &&
    // eslint-disable-next-line react-hooks/purity
    Date.now() - new Date(resignationRecord.submittedAt).getTime() >= NOTIFY_DELAY_MS;

  const handleResendInvite = () =>
    resendInvite(id, {
      onSuccess: () => toast.success('Invite resent successfully'),
      onError: () => toast.error('Failed to resend invite'),
    });

  const handleAssignPermissionSet = (permissionSetId: string) => {
    if (!employee?.userId) return;
    assignPermissionSet(
      { userId: employee.userId, permissionSetId },
      {
        onSuccess: () => toast.success('Permission set assigned successfully'),
        onError: () => toast.error('Failed to assign permission set'),
      },
    );
  };

  const handleRemovePermissionSet = (permissionSetId: string) => {
    if (!employee?.userId) return;
    removePermissionSet(
      { userId: employee.userId, permissionSetId },
      {
        onSuccess: () => toast.success('Permission set removed successfully'),
        onError: () => toast.error('Failed to remove permission set'),
      },
    );
  };

  if (isLoading) return <EmployeeDetailSkeleton />;

  if (!employee) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center text-sm text-gray-400">
        {status === 403
          ? "You don't have permission to access this. Contact your administrator."
          : 'Employee not found.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0`}>
        <Breadcrumb tenantSlug={tenantSlug} name={`${employee.firstName} ${employee.lastName}`} />
      </div>

      {/* Banner */}
      <div className={`${pageBanner} shrink-0`}>
        <EmployeeDetailBanner
          employee={employee}
          hasPendingResignation={hrIsNotified}
          onEdit={canEditEmployee ? () => setActivePanel('edit') : undefined}
          onOffboard={canOffboardEmployee ? () => setActivePanel('offboard') : undefined}
          onResign={() => setActivePanel('resign')}
          onResendInvite={handleResendInvite}
          isResending={isResending}
        />
      </div>

      {/* Tab bar */}
      <div className={`${pagePx} shrink-0`}>
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as EmployeeTab)}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={pageContent}>
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 flex flex-col gap-4">
                <PersonalInformationSection employee={employee} showNationalId />
                <EmergencyContactSection employee={employee} />
                <AssetsSection
                  assets={employee.assets ?? []}
                  onAssignAsset={canAssignAsset ? () => setActivePanel('assign-asset') : undefined}
                />
              </div>
              <div className="lg:col-span-1">
                <EmployeeDetailSidebar
                  employee={employee}
                  managerName={managerName}
                  roles={roles}
                  canEditRoles={canGrantPermission}
                  canManagePermissions={canGrantPermission}
                  onEditRoles={() => setActivePanel('roles')}
                  onManagePermissions={() => setActivePanel('permissions')}
                  directPermissions={directPermissions}
                />
              </div>
            </div>
          )}
          {activeTab === 'payroll' && <EmployeePayslipTab employee={employee} />}
        </div>
      </div>

      <EmployeeDetailPanels
        activePanel={activePanel}
        onClose={() => setActivePanel(null)}
        employee={employee}
        allHrEmployees={allHrEmployees}
        availableAssets={availableAssets}
        customPermissionSets={customPermissionSets}
        assignedSets={assignedSets}
        isAssigningPermissionSet={isAssigningPermissionSet}
        isRemovingPermissionSet={isRemovingPermissionSet}
        onAssignPermissionSet={handleAssignPermissionSet}
        onRemovePermissionSet={handleRemovePermissionSet}
      />
    </div>
  );
}
