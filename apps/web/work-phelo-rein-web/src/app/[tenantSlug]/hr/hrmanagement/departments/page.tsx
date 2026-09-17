'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { DepartmentsTable } from '@/components/organisms/hr/departments/departmentTable';

export default function DepartmentsPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const user = useAuthStore((s) => s.user);
  const { canReadDepartments } = useHrManagementAccess();

  useEffect(() => {
    if (user !== null && !canReadDepartments) {
      router.replace(`/${params.tenantSlug}/hr`);
    }
  }, [canReadDepartments, router, user, params.tenantSlug]);

  if (user !== null && !canReadDepartments) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Departments</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage company departments and their details</p>
      </div>
      <DepartmentsTable />
    </div>
  );
}
