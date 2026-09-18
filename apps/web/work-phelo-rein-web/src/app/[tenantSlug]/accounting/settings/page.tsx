import { redirect } from 'next/navigation';

export default async function AccountingSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/accounting/settings/vendors`);
}
