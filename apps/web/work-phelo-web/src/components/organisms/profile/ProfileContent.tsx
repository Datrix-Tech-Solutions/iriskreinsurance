'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useMyProfile,
  useUpdateMyProfile,
  useResignationRecord,
  useEmployeeOptions,
} from '@/hooks/hr/useEmployees';
import {
  useUserPermissions,
  usePermissionSets,
  useAssignPermissionSet,
  useRemovePermissionSet,
} from '@/hooks/hr/useRoles';
import { usePermission, usePermissionRule } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/useToast';
import { useUploadMyAvatar } from '@/hooks/useMyAvatar';
import { extractError } from '@/lib/extractError';
import { pagePx, pageContent } from '@/lib/layout';
import { ProfileBanner } from '@/components/molecules/hr/employees/ProfileBanner';
import { ProfileSummaryCard } from '@/components/molecules/hr/employees/ProfileSummaryCard';
import { ProfilePerformanceSummaryCard } from '@/components/molecules/hr/employees/ProfilePerformanceSummaryCard';
import { PersonalInformationSection } from '@/components/molecules/hr/employees/PersonalInformationSection';
import { RolesAndPermissionsCard } from '@/components/molecules/hr/employees/RolesAndPermissionsCard';
import { ProfileLeaveBalancesSection } from '@/components/molecules/hr/employees/ProfileLeaveBalancesSection';
import { ProfileProjectsSection } from '@/components/molecules/hr/employees/ProfileProjectsSection';
import { AssetsSection } from '@/components/molecules/hr/employees/assetSection';
import { ProfilePayslipTab } from '@/components/molecules/hr/employees/ProfilePayslipTab';
import { MyAppraisalsTable } from '@/components/organisms/hr/appraisal/MyAppraisalTable';
import { AnnouncementsContent } from '@/components/organisms/hr/announcements/AnnouncementsContent';
import { SchedulingContent } from '@/components/organisms/hr/scheduling/SchedulingContent';
import { EditMyProfilePanel } from '@/components/organisms/hr/employee/EditMyProfilePanel';
import { ProfilePhotoDialog } from '@/components/organisms/hr/employee/ProfilePhotoDialog';
import { ResignationPanel } from '@/components/organisms/hr/employee/resignationPanel';
import { ApplyLeavePanel } from '@/components/organisms/hr/leave/ApplyLeavePanel';
import { EmployeePermissionsPanel } from '@/components/organisms/roles/EmployeePermissionsPanel';
import { AssignPermissionPanel } from '@/components/organisms/roles/assignPermissionPanel';
import { useLeaveBalances } from '@/hooks/hr/useLeave';
import { EmployeeDetailSkeleton } from '@/components/molecules/hr/employees/employeeDetailSkeleton';
import type { LeaveBalance, UpdateEmployeePayload } from '@/types/hr';

type ProfileTab =
  | 'personal'
  | 'performance'
  | 'banking'
  | 'documents'
  | 'announcements'
  | 'scheduling';

export function ProfileContent() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [editOpen, setEditOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [applyLeaveTypeId, setApplyLeaveTypeId] = useState<string | null>(null);
  const [rolesPanelOpen, setRolesPanelOpen] = useState(false);
  const [permissionsPanelOpen, setPermissionsPanelOpen] = useState(false);
  const toast = useToast();

  const { data: leaveBalancesRaw } = useLeaveBalances();
  const leaveBalances: LeaveBalance[] = Array.isArray(leaveBalancesRaw)
    ? leaveBalancesRaw
    : ((leaveBalancesRaw as { data?: LeaveBalance[] } | undefined)?.data ?? []);

  const { data: employee, isLoading } = useMyProfile();
  const { mutate: updateMyProfile, isPending: isUpdating } = useUpdateMyProfile();
  const { mutate: uploadAvatar, isPending: isUploadingAvatar } = useUploadMyAvatar();
  const { data: resignationRecord } = useResignationRecord(employee?.id ?? '');
  const { data: allEmployees = [] } = useEmployeeOptions();
  const canEditProfile = usePermission(Permission.UPDATE_OWN_PROFILE);
  const canGrantPermission = usePermission(Permission.GRANT_PERMISSION);
  const { data: userPermsRaw } = useUserPermissions(employee?.userId ?? '');
  const { data: permissionSets = [] } = usePermissionSets({ enabled: canGrantPermission });
  const { mutate: assignPermissionSet, isPending: isAssigningPermissionSet } =
    useAssignPermissionSet();
  const { mutate: removePermissionSet, isPending: isRemovingPermissionSet } =
    useRemovePermissionSet();

  // These 4 used to be their own persistent sidebar entries — same access
  // rules as their standalone pages, now surfaced as profile tabs instead.
  const user = useAuthStore((s) => s.user);
  const canAccessAnnouncements = usePermission(Permission.MANAGE_ANNOUNCEMENTS);
  const canReadSchedules = usePermissionRule('schedules:VIEW');
  const canManageSchedules = usePermission(Permission.MANAGE_SCHEDULES);
  const canApproveShiftSwap = usePermission(Permission.APPROVE_SHIFT_SWAP);
  const canAccessScheduling = canReadSchedules || canManageSchedules || canApproveShiftSwap;
  const canAccessProjects = Boolean(user?.featureConfig?.hr?.projects);

  const canCreateAppraisal = usePermission(Permission.CREATE_APPRAISAL);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canFinalizeAppraisal = usePermission(Permission.FINALIZE_APPRAISAL);
  const canManageAppraisals =
    canCreateAppraisal || canConfigureAppraisal || canFinalizeAppraisal;

  const [appraisalSearch, setAppraisalSearch] = useState('');
  const [appraisalPage, setAppraisalPage] = useState(1);

  const TABS = [
    { key: 'personal', label: 'My Data' },
    { key: 'performance', label: 'Performance' },
    { key: 'banking', label: 'Payroll' },
    { key: 'documents', label: 'My Documents' },
    canAccessAnnouncements && { key: 'announcements', label: 'Announcements' },
    canAccessScheduling && { key: 'scheduling', label: 'Smart Scheduling' },
  ].filter((tab): tab is { key: string; label: string } => Boolean(tab));

  const userPermsTyped = userPermsRaw as
    | {
        permissionSets?: { id: string; name: string }[];
        directPermissions?: { resourceName: string; action: string }[];
      }
    | undefined;
  const assignedSets = userPermsTyped?.permissionSets ?? [];
  const directPermissions = userPermsTyped?.directPermissions ?? [];
  const customPermissionSets = permissionSets.filter((s) => !s.isSystem);

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
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center text-sm text-gray-400">
        Profile not found. Contact your administrator.
      </div>
    );
  }

  const employeeName = `${employee.firstName} ${employee.lastName}`;

  const handlePhotoSave = (file: File | null) => {
    if (!file) {
      // No "remove avatar" endpoint yet — nothing to do.
      setPhotoOpen(false);
      return;
    }
    uploadAvatar(file, {
      onSuccess: () => {
        // The hook awaits the profile refetch, so the banner already has the
        // new signed URL by the time we close.
        setPhotoOpen(false);
        toast.success('Profile photo updated');
      },
      onError: (err) => toast.error(extractError(err, 'Could not upload that photo')),
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pagePx} pb-4 sm:pb-6 shrink-0 relative z-20`}>
        <ProfileBanner
          color="#0047AB"
          // color= "orange"
          // backgroundImage="/images/profile-banner.webp"  // drop asset in public/images/, then uncomment
          employee={employee}
          hasPendingResignation={hasPendingResignation}
          canEdit={canEditProfile}
          onResign={() => setResignOpen(true)}
          onEdit={() => setEditOpen(true)}
          onEditAvatar={canEditProfile ? () => setPhotoOpen(true) : undefined}
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as ProfileTab)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={pageContent}>
          {activeTab === 'personal' && (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <div className="shrink-0">
                <PersonalInformationSection employee={employee} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <ProfileSummaryCard employee={employee} managerName={managerName} />
                <ProfileLeaveBalancesSection onSelect={setApplyLeaveTypeId} />
                {canAccessProjects && <ProfileProjectsSection />}
                <AssetsSection
                  assets={employee.assets ?? []}
                  onManage={() => router.push(`/${tenantSlug}/hr/assets`)}
                />
                <RolesAndPermissionsCard
                  roles={roles}
                  directPermissions={directPermissions}
                  canEditRoles={canGrantPermission}
                  onEditRoles={() => setRolesPanelOpen(true)}
                  onManageRoles={
                    canGrantPermission
                      ? () => router.push(`/${tenantSlug}/hr/hrmanagement/roles`)
                      : undefined
                  }
                  canManagePermissions={canGrantPermission}
                  onManagePermissions={() => setPermissionsPanelOpen(true)}
                />
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2">
                <MyAppraisalsTable
                  search={appraisalSearch}
                  onSearch={setAppraisalSearch}
                  page={appraisalPage}
                  onPageChange={setAppraisalPage}
                  onManage={
                    canManageAppraisals
                      ? () => router.push(`/${tenantSlug}/hr/appraisal`)
                      : undefined
                  }
                />
              </div>
              <div className="lg:col-span-1">
                <ProfilePerformanceSummaryCard />
              </div>
            </div>
          )}

          {activeTab === 'banking' && <ProfilePayslipTab />}

          {activeTab === 'documents' && <div />}

          {activeTab === 'announcements' && canAccessAnnouncements && (
            <div className="flex flex-col gap-6">
              <AnnouncementsContent />
            </div>
          )}
          {activeTab === 'scheduling' && canAccessScheduling && (
            <div className="flex flex-col gap-6">
              <SchedulingContent tenantSlug={tenantSlug} />
            </div>
          )}
        </div>
      </div>

      <EditMyProfilePanel
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        employee={employee}
        onSave={handleSave}
        isUpdating={isUpdating}
      />
      {photoOpen && (
        <ProfilePhotoDialog
          isOpen
          onClose={() => setPhotoOpen(false)}
          name={employeeName}
          currentUrl={employee.avatarUrl}
          onSave={handlePhotoSave}
          isSaving={isUploadingAvatar}
        />
      )}
      <ResignationPanel
        isOpen={resignOpen}
        onClose={() => setResignOpen(false)}
        employee={employee}
      />
      <ApplyLeavePanel
        isOpen={applyLeaveTypeId !== null}
        onClose={() => setApplyLeaveTypeId(null)}
        tenantSlug={tenantSlug}
        balances={leaveBalances}
        initialLeaveTypeId={applyLeaveTypeId ?? undefined}
      />
      {employee.userId && (
        <EmployeePermissionsPanel
          isOpen={rolesPanelOpen}
          onClose={() => setRolesPanelOpen(false)}
          employeeName={employeeName}
          userId={employee.userId}
          availableSets={customPermissionSets}
          assignedSets={assignedSets}
          baseSetName={null}
          onAssign={handleAssignPermissionSet}
          onRemove={handleRemovePermissionSet}
          isAssigning={isAssigningPermissionSet}
          isRemoving={isRemovingPermissionSet}
        />
      )}
      {employee.userId && (
        <AssignPermissionPanel
          isOpen={permissionsPanelOpen}
          onClose={() => setPermissionsPanelOpen(false)}
          employeeName={employeeName}
          userId={employee.userId}
        />
      )}
    </div>
  );
}
