//EMPLOYEES PAGE //

'use client';

import { use } from 'react';
import { EmployeeDirectory } from '@/components/organisms/hr/employees/EmployeeDirectory';

export default function EmployeesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);

  return <EmployeeDirectory tenantSlug={tenantSlug} />;
}
