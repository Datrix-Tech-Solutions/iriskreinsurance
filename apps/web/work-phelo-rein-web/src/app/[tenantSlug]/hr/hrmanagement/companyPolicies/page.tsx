import { redirect } from 'next/navigation';

export default async function CompanyPoliciesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/hr/hrmanagement/companyPolicies/employment`);
}
