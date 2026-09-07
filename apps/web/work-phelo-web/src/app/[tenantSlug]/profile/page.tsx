// MY PROFILE PAGE

'use client';

import { use, useState } from 'react';
import { useMyProfile, useUpdateMyProfile, useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/useToast';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { EditMyProfilePanel } from '@/components/organisms/hr/employee/EditMyProfilePanel';
import { EmployeeProfileCard } from '@/components/molecules/hr/employees/employeeProfileCard';
import { EmploymentDetailsSection } from '@/components/molecules/hr/employees/employeeDetailsSection';
import { AccountDetailsSection } from '@/components/molecules/hr/employees/accountDetailSection';
import { EmployeeDetailSkeleton } from '@/components/molecules/hr/employees/employeeDetailSkeleton';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { AppBackground } from '@/components/atoms/AppBackground';
import type { UpdateEmployeePayload } from '@/types/hr';

export default function MyProfilePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const [editOpen, setEditOpen] = useState(false);

  const { data: employee, isLoading } = useMyProfile();
  const { mutate: updateMyProfile, isPending: isUpdating } = useUpdateMyProfile();
  const { data: allEmployees = [] } = useEmployeeOptions();
  const toast = useToast();

  const handleSave = (data: UpdateEmployeePayload) => {
    if (!employee) return;
    updateMyProfile(data, {
      onSuccess: () => {
        toast.success('Profile updated successfully');
        setEditOpen(false);
      },
      onError: () => toast.error('Failed to update profile'),
    });
  };

  return (
    <AppBackground className="h-dvh overflow-hidden flex flex-col">
      <TopNav userInitials={initials} />

      <main className="flex-1 min-h-0 overflow-y-auto">
        {isLoading || !employee ? (
          <EmployeeDetailSkeleton />
        ) : (
          <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
                <p className="text-sm text-gray-400 mt-0.5">{tenantSlug}</p>
              </div>
              <Button className="gap-2" onClick={() => setEditOpen(true)}>
                Edit Profile
                <Icons.Pencil className="w-4 h-4" />
              </Button>
            </div>

            {/* Main content */}
            <div className="flex gap-6 items-start">
              {/* Left sidebar */}
              <EmployeeProfileCard employee={employee} />

              {/* Right sections */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <EmploymentDetailsSection employee={employee} allHrEmployees={allEmployees} />
                <AccountDetailsSection employee={employee} />
              </div>
            </div>
          </div>
        )}
      </main>

      {employee && (
        <EditMyProfilePanel
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          employee={employee}
          onSave={handleSave}
          isUpdating={isUpdating}
        />
      )}
    </AppBackground>
  );
}
