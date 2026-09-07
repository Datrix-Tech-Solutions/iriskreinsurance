'use client';

import { useState } from 'react';
import {
  useMyProfile,
  useUpdateMyProfile,
  useResignationRecord,
  useEmployeeOptions,
} from '@/hooks/hr/useEmployees';
import { useUserPermissions } from '@/hooks/hr/useRoles';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { pageBanner, pagePx, pageContent } from '@/lib/layout';
import { ProfileBanner } from '@/components/molecules/hr/employees/ProfileBanner';
import { ProfileSummaryCard } from '@/components/molecules/hr/employees/ProfileSummaryCard';
import { ProfilePerformanceTab } from '@/components/molecules/hr/employees/ProfilePerformanceTab';
import { ProfilePerformanceSummaryCard } from '@/components/molecules/hr/employees/ProfilePerformanceSummaryCard';
import { PersonalInformationSection } from '@/components/molecules/hr/employees/PersonalInformationSection';
import { EmployeePermissionsCard } from '@/components/molecules/hr/employees/EmployeePermissionsCard';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { EmergencyContactSection } from '@/components/molecules/hr/employees/emergencyContactSection';
import { AssetsSection } from '@/components/molecules/hr/employees/assetSection';
import { ProfilePayslipTab } from '@/components/molecules/hr/employees/ProfilePayslipTab';
import { EditMyProfilePanel } from '@/components/organisms/hr/employee/EditMyProfilePanel';
import { ResignationPanel } from '@/components/organisms/hr/employee/resignationPanel';
import { EmployeeDetailSkeleton } from '@/components/molecules/hr/employees/employeeDetailSkeleton';
import type { UpdateEmployeePayload } from '@/types/hr';

type ProfileTab = 'personal' | 'performance' | 'banking';

const TABS = [
  { key: 'personal', label: 'Personal Information' },
  { key: 'performance', label: 'Performance' },
  { key: 'banking', label: 'Payroll' },
];

export function ProfileContent() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [editOpen, setEditOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const toast = useToast();

  const { data: employee, isLoading } = useMyProfile();
  const { mutate: updateMyProfile, isPending: isUpdating } = useUpdateMyProfile();
  const { data: resignationRecord } = useResignationRecord(employee?.id ?? '');
  const { data: allEmployees = [] } = useEmployeeOptions();
  const canEditProfile = usePermission(Permission.UPDATE_OWN_PROFILE);
  const { data: userPermsRaw } = useUserPermissions(employee?.userId ?? '');

  const userPermsTyped = userPermsRaw as
    | {
        permissionSets?: { id: string; name: string }[];
        directPermissions?: { resourceName: string; action: string }[];
      }
    | undefined;
  const assignedSets = userPermsTyped?.permissionSets ?? [];
  const directPermissions = userPermsTyped?.directPermissions ?? [];

  const managerName = (() => {
    if (!employee?.managerId) return undefined;
    const mgr = allEmployees.find((e) => e.id === employee.managerId);
    return mgr ? `${mgr.firstName} ${mgr.lastName}` : undefined;
  })();

  const roles = assignedSets.map((s) => s.name);
  const hasPendingResignation = resignationRecord?.status === 'PENDING';

  const handleSave = (data: UpdateEmployeePayload) => {
    if (!employee) return;
    updateMyProfile(data, {
      onSuccess: () => {
        toast.success('Profile updated successfully');
        setEditOpen(false);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to update profile')),
    });
  };

  if (isLoading) return <EmployeeDetailSkeleton />;
  if (!employee) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center text-sm text-gray-400">
        Profile not found. Contact your administrator.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBanner} shrink-0`}>
        <ProfileBanner
          employee={employee}
          hasPendingResignation={hasPendingResignation}
          canEdit={canEditProfile}
          onResign={() => setResignOpen(true)}
          onEdit={() => setEditOpen(true)}
        />
      </div>

      <div className={`${pagePx} shrink-0`}>
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as ProfileTab)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={pageContent}>
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 flex flex-col gap-4">
                <PersonalInformationSection employee={employee} />
                <EmergencyContactSection employee={employee} />
                <AssetsSection assets={employee.assets ?? []} />
              </div>
              <div className="lg:col-span-1 flex flex-col gap-4">
                <ProfileSummaryCard employee={employee} managerName={managerName} roles={roles} />
                <EmployeePermissionsCard
                  canManage={false}
                  onManage={() => {}}
                  directPermissions={directPermissions}
                  hideWhenEmpty
                />
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2">
                <SectionCard title="Completed Appraisals">
                  <ProfilePerformanceTab />
                </SectionCard>
              </div>
              <div className="lg:col-span-1">
                <ProfilePerformanceSummaryCard />
              </div>
            </div>
          )}

          {activeTab === 'banking' && <ProfilePayslipTab />}
        </div>
      </div>

      <EditMyProfilePanel
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        employee={employee}
        onSave={handleSave}
        isUpdating={isUpdating}
      />
      <ResignationPanel
        isOpen={resignOpen}
        onClose={() => setResignOpen(false)}
        employee={employee}
      />
    </div>
  );
}
