import { redirect } from 'next/navigation';

export default async function ReinsuranceSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/operations/reinsurance/settings/risk-classes`);
}
