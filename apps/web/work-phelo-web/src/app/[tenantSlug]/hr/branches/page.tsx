import { redirect } from 'next/navigation';

export default async function BranchesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/hr/hrmanagement/branches`);
}
