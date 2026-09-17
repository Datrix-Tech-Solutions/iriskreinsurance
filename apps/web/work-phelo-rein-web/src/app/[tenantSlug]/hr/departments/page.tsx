import { redirect } from 'next/navigation';

export default async function DepartmentsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/hr/hrmanagement/departments`);
}
